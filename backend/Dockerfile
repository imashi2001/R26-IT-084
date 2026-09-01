# Build from repository root:
#   docker build -f backend/Dockerfile -t visionwaste-backend .
#
# Railway: Root Directory = . (repo root), Dockerfile Path = backend/Dockerfile

FROM node:20-bookworm-slim

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ ./
COPY waste_forecast/ /app/waste_forecast/
COPY ["forecasting dashboard/", "/app/forecasting dashboard/"]

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && pip3 install --no-cache-dir -r /app/waste_forecast/requirements.txt \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV REPO_ROOT=/app
ENV WORKSPACE_ROOT=/app

EXPOSE 5000

CMD ["npm", "start"]
