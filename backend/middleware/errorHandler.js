const multer = require("multer");

const { IS_PROD } = require("../config/env");

function notFound(_req, res, _next) {
  res.status(404).json({ error: "Route not found" });
}

function errorHandler(err, req, res, _next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }

  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  }

  // Unexpected 5xx errors can carry DB / stack internals; hide them in production.
  // Errors raised deliberately with an explicit status keep their message.
  const hideDetails = IS_PROD && status >= 500 && !err.status;
  const body = {
    error: hideDetails ? "Internal server error" : err.message || "Internal error",
  };
  if (!hideDetails && err.detail !== undefined) body.detail = err.detail;

  return res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
