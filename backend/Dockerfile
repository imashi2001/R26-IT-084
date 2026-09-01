# Railway backend — works with Root Directory = backend OR repo root (.)
# Dockerfile Path: Dockerfile (when Root Directory = backend)
#                  backend/Dockerfile (when Root Directory = .)
#
# Forecasting: set MODEL_FORECAST_URL to forecast-api (no Python in this image).
# Build marker: 2026-09-01-v2

FROM node:20-bookworm-slim

WORKDIR /app

# Copy full build context, then pick backend/ or flat layout (Railway root dir varies).
COPY . /ctx/
RUN set -eux; \
  if [ -f /ctx/package.json ]; then \
    cp -a /ctx/. /app/; \
  elif [ -f /ctx/backend/package.json ]; then \
    cp -a /ctx/backend/. /app/; \
  else \
    echo "ERROR: package.json not found in build context"; \
    ls -la /ctx; \
    exit 1; \
  fi; \
  rm -rf /ctx

RUN npm ci --omit=dev

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start"]
