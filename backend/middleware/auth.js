const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const { JWT_SECRET, DEVICE_API_KEY } = require("../config/env");

function assertJwtConfigured() {
  if (!JWT_SECRET || JWT_SECRET.length < 8) {
    const err = new Error(
      "Set JWT_SECRET in backend environment (min 8 chars) to enable login."
    );
    err.status = 503;
    throw err;
  }
}

function bearerToken(req) {
  const header = (req.headers.authorization || "").toString();
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

/**
 * Verify a JWT and return { user } or { error: { status, body } }.
 */
function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return {
      user: { id: payload.sub, email: payload.email, role: payload.role },
    };
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return {
        error: {
          error: "Session expired. Please sign in again.",
          code: "token_expired",
        },
      };
    }
    if (err.name === "JsonWebTokenError") {
      return {
        error: {
          error: "Invalid token. Please sign in again.",
          code: "token_invalid",
        },
      };
    }
    return { error: { error: "Invalid or expired token", code: "token_error" } };
  }
}

function buildRequireAuth({ allowQueryToken = false } = {}) {
  return function requireAuthMw(req, res, next) {
    try {
      assertJwtConfigured();
    } catch (e) {
      return res.status(e.status || 503).json({ error: e.message });
    }

    let token = bearerToken(req);
    if (!token && allowQueryToken && typeof req.query.token === "string") {
      token = req.query.token.trim() || null;
    }
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { user, error } = verifyToken(token);
    if (error) return res.status(401).json(error);
    req.user = user;
    return next();
  };
}

/**
 * Attach req.user = { id, email, role } from Bearer JWT.
 */
const requireAuth = buildRequireAuth();

/**
 * Same as requireAuth, but also accepts ?token=<jwt>. Only for binary
 * endpoints rendered by <img src>, which cannot send an Authorization header.
 */
const requireAuthAllowQuery = buildRequireAuth({ allowQueryToken: true });

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

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function hasValidDeviceKey(req) {
  if (!DEVICE_API_KEY) return false;
  const provided = (req.headers["x-device-key"] || "").toString().trim();
  return Boolean(provided) && safeEqual(provided, DEVICE_API_KEY);
}

/**
 * For endpoints used by ESP32 boards / the laptop bridge.
 * Accepts X-Device-Key (DEVICE_API_KEY) or a logged-in user's JWT.
 * When DEVICE_API_KEY is unset the endpoint stays open (legacy mode).
 */
function requireDevice(req, res, next) {
  if (!DEVICE_API_KEY) return next();
  if (hasValidDeviceKey(req)) {
    req.device = { authenticated: true };
    return next();
  }

  const token = bearerToken(req);
  if (token && JWT_SECRET) {
    const { user } = verifyToken(token);
    if (user) {
      req.user = user;
      return next();
    }
  }

  return res.status(401).json({
    error: "Device key or user login required",
    code: "device_auth_required",
  });
}

module.exports = {
  requireAuth,
  requireAuthAllowQuery,
  requireRole,
  requireDevice,
  assertJwtConfigured,
};
