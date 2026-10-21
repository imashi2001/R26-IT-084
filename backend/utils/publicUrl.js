/**
 * Public URL builder when Express sits behind a TLS-terminating proxy (Railway).
 */
function getPublicBaseUrl(req) {
  const forwardedProto = (req.headers["x-forwarded-proto"] || "").toString();
  const proto =
    forwardedProto.split(",")[0].trim() || req.protocol || "http";
  return `${proto}://${req.get("host")}`;
}

module.exports = { getPublicBaseUrl };
