"""Tests for littering-action-api (mocked YOLO — no PyTorch model load in unit tests)."""

from __future__ import annotations

import io
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

import app as litter_app


@pytest.fixture
def client():
  return TestClient(litter_app.app)


def _jpeg_bytes() -> bytes:
  buf = io.BytesIO()
  Image.new("RGB", (64, 48), color=(120, 80, 40)).save(buf, format="JPEG")
  return buf.getvalue()


def _mock_model(names=None, boxes=None):
  names = names or {0: "littering"}
  model = MagicMock()
  model.task = "detect"
  model.names = names

  if boxes is None:
    xyxy = np.zeros((0, 4))
    confs = np.zeros((0,))
    clss = np.zeros((0,), dtype=np.int64)
    res = SimpleNamespace(boxes=None, names=names)
  else:
    xyxy, confs, clss = boxes
    box_ns = SimpleNamespace(
      xyxy=MagicMock(cpu=MagicMock(return_value=MagicMock(numpy=lambda: xyxy))),
      conf=MagicMock(cpu=MagicMock(return_value=MagicMock(numpy=lambda: confs))),
      cls=MagicMock(
        cpu=MagicMock(
          return_value=MagicMock(numpy=lambda: clss.astype(np.int64))
        )
      ),
    )
    box_ns.__len__ = lambda: xyxy.shape[0]
    res = SimpleNamespace(boxes=box_ns, names=names)
  model.predict.return_value = [res]
  return model


@patch.object(litter_app, "_load_model")
def test_health_ok(mock_load, client):
  mock_load.return_value = _mock_model()
  r = client.get("/health")
  assert r.status_code == 200
  body = r.json()
  assert body["model_loaded"] is True
  assert body["class_names"] == ["littering"]
  assert body["task"] == "detect"


@patch.object(litter_app, "_load_model")
def test_predict_valid_image_no_detections(mock_load, client):
  mock_load.return_value = _mock_model()
  r = client.post(
    "/predict",
    files={"file": ("frame.jpg", _jpeg_bytes(), "image/jpeg")},
  )
  assert r.status_code == 200
  body = r.json()
  assert body["success"] is True
  assert body["event_detected"] is False
  assert body["event_count"] == 0
  assert body["max_confidence"] == 0.0


@patch.object(litter_app, "_load_model")
def test_predict_one_detection(mock_load, client):
  xyxy = np.array([[10.0, 20.0, 40.0, 50.0]])
  confs = np.array([0.87])
  clss = np.array([0])
  mock_load.return_value = _mock_model(boxes=(xyxy, confs, clss))
  r = client.post(
    "/predict",
    files={"file": ("frame.jpg", _jpeg_bytes(), "image/jpeg")},
  )
  body = r.json()
  assert body["event_detected"] is True
  assert body["event_count"] == 1
  assert body["max_confidence"] == pytest.approx(0.87)
  assert body["detections"][0]["class_name"] == "littering"


@patch.object(litter_app, "_load_model")
def test_predict_multiple_detections(mock_load, client):
  xyxy = np.array([[1, 2, 3, 4], [5, 6, 7, 8]], dtype=np.float64)
  confs = np.array([0.6, 0.9])
  clss = np.array([0, 0])
  mock_load.return_value = _mock_model(boxes=(xyxy, confs, clss))
  r = client.post(
    "/predict",
    files={"file": ("frame.jpg", _jpeg_bytes(), "image/jpeg")},
  )
  body = r.json()
  assert body["event_count"] == 2
  assert body["max_confidence"] == pytest.approx(0.9)


@patch.object(litter_app, "_load_model")
def test_predict_confidence_threshold_passed(mock_load, client):
  mock_load.return_value = _mock_model()
  client.post(
    "/predict",
    files={"file": ("frame.jpg", _jpeg_bytes(), "image/jpeg")},
    data={"confidence": "0.75"},
  )
  kwargs = mock_load.return_value.predict.call_args.kwargs
  assert kwargs["conf"] == pytest.approx(0.75)


def test_predict_missing_file(client):
  r = client.post("/predict", data={})
  assert r.status_code == 422


def test_predict_invalid_image(client):
  r = client.post(
    "/predict",
    files={"file": ("bad.jpg", b"not-an-image", "image/jpeg")},
  )
  assert r.status_code == 400


@patch.object(litter_app, "_load_model")
def test_predict_model_unavailable(mock_load, client):
  mock_load.side_effect = FileNotFoundError("missing weights")
  r = client.post(
    "/predict",
    files={"file": ("frame.jpg", _jpeg_bytes(), "image/jpeg")},
  )
  assert r.status_code == 503


@pytest.mark.smoke
@patch.object(litter_app, "MODEL_PATH", litter_app.ROOT / "weights" / "best.pt")
def test_smoke_real_model_if_present(client):
  if not (litter_app.ROOT / "weights" / "best.pt").is_file():
    pytest.skip("weights/best.pt not present")
  litter_app._load_model.cache_clear()
  r = client.get("/health")
  assert r.status_code == 200
  assert r.json()["model_loaded"] is True
  assert "littering" in [n.lower() for n in r.json().get("class_names", [])]
