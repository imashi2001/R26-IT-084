# Express API gateway (backend/). Used when this Railway service has no
# Root Directory set — the GitHub-connected service is named after the repo.
# Prefer Settings → Root Directory = backend (then backend/Dockerfile is used).
FROM node:20-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ ./

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
