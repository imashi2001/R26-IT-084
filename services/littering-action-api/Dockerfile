FROM python:3.11-slim

ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    YOLO_CONFIG_DIR=/tmp/Ultralytics

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY app.py ./
COPY weights/ /app/weights/

ENV PORT=8000 \
    LITTERING_MODEL_PATH=/app/weights/best.pt \
    LITTERING_CONFIDENCE=0.50 \
    LITTERING_IOU=0.45 \
    LITTERING_MAX_DETECTIONS=100 \
    LITTERING_DEVICE=cpu

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
