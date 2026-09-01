# Railway Root Directory: services/forecast-api
# Dockerfile Path: Dockerfile  (default)
#
# Local test:
#   cd services/forecast-api
#   docker build -t forecast-api .

FROM python:3.11-slim

ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WORKSPACE_ROOT=/app \
    WASTE_FORECAST_ROOT=/app/waste_forecast \
    HOLIDAY_CACHE_PATH=/app/waste_forecast/data/holiday_cache.json

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY app.py ./app.py
COPY waste_forecast/ ./waste_forecast/

RUN test -f /app/waste_forecast/data/holiday_cache.json \
    && test -f /app/waste_forecast/models/model.json

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
