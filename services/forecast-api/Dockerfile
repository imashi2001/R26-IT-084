# Build from repository root (not services/forecast-api):
#   docker build -f services/forecast-api/Dockerfile -t forecast-api .
#
# Railway: Root Directory = . (repo root), Dockerfile Path = services/forecast-api/Dockerfile

FROM python:3.11-slim

ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WORKSPACE_ROOT=/app

WORKDIR /app

COPY services/forecast-api/requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY services/forecast-api/app.py ./app.py
COPY waste_forecast/ ./waste_forecast/
# holiday_cache.json lives at waste_forecast/data/ (backend/ excluded from some Railway build contexts)

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
