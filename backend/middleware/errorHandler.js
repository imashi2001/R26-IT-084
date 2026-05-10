const multer = require("multer");

function notFound(_req, res, _next) {
  res.status(404).json({ error: "Route not found" });
}

function errorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }

  const status = err.status || 500;
  const body = { error: err.message || "Internal error" };
  if (err.detail !== undefined) body.detail = err.detail;

  return res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
