# Express API gateway (backend/). Same image as backend/Dockerfile.
# Railway: Root Directory = . , Dockerfile Path = Dockerfile  (or backend/Dockerfile).
FROM node:20-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ ./

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
