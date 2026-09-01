# Railway Root Directory: backend
# Dockerfile Path: Dockerfile
#
# Forecasting runs on forecast-api (MODEL_FORECAST_URL) — no Python/waste_forecast in this image.
#
# Local Docker:
#   cd backend && docker build -t visionwaste-backend .

FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start"]
