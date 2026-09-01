# Railway builds with REPO ROOT as Docker context when Dockerfile path is
# services/forecast-api/Dockerfile — use paths relative to repo root.
#
# Local test from repo root:
#   docker build -f services/forecast-api/Dockerfile -t forecast-api .
#
# Railway:
#   Root Directory = .  (repo root)  OR  services/forecast-api
#   Dockerfile Path  = services/forecast-api/Dockerfile  OR  Dockerfile

FROM python:3.11-slim

ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WORKSPACE_ROOT=/app

WORKDIR /app

# Repo-root context (Railway default when Dockerfile path includes services/forecast-api/)
COPY services/forecast-api/requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY services/forecast-api/app.py ./app.py
COPY services/forecast-api/waste_forecast/ ./waste_forecast/

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
