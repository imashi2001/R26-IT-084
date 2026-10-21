# Repo-root backend image (only when Railway Root Directory is unset / ".").
# Prefer Root Directory = backend and backend/Dockerfile instead.
FROM node:20-bookworm-slim

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ ./

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start"]
