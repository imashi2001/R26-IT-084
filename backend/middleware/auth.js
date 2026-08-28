const jwt = require("jsonwebtoken");

const { JWT_SECRET } = require("../config/env");

function assertJwtConfigured() {
  if (!JWT_SECRET || JWT_SECRET.length < 8) {
    const err = new Error(
      "Set JWT_SECRET in backend environment (min 8 chars) to enable login."
    );
    err.status = 503;
    throw err;
  }
}

/**
 * Attach req.user = { id, email, role } from Bearer JWT.
 */
function requireAuth(req, res, next) {
  try {
    assertJwtConfigured();
  } catch (e) {
    return res.status(e.status || 503).json({ error: e.message });
  }

  const header = (req.headers.authorization || "").toString();
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Session expired. Please sign in again.",
        code: "token_expired",
      });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Invalid token. Please sign in again.",
        code: "token_invalid",
      });
    }
    return res.status(401).json({
      error: "Invalid or expired token",
      code: "token_error",
    });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Admin role required" });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole, assertJwtConfigured };
