# Railway backend service:
#   Root Directory  = backend
#   Dockerfile Path = Dockerfile
#
# Local build (same context Railway uses):
#   cd backend && docker build -t visionwaste-backend .
#
# Forecasting runs on forecast-api — set MODEL_FORECAST_URL (no Python in this image).

FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start"]
