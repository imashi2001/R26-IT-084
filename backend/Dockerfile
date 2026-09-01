# Build from repository root (Railway default when Root Directory is unset):
#   docker build -f backend/Dockerfile -t visionwaste-backend .
#
# Railway backend service:
#   Root Directory = .  (repo root — required for the COPY backend/ paths below)
#   Dockerfile Path  = backend/Dockerfile
#
# Forecasting runs on forecast-api — set MODEL_FORECAST_URL on this service (no Python here).

FROM node:20-bookworm-slim

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ ./

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start"]
