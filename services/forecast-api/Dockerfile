# Build from repo root:
#   docker build -f services/forecast-api/Dockerfile -t forecast-api .
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

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
