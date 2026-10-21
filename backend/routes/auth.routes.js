const { Router } = require("express");
const rateLimit = require("express-rate-limit");

const { register, login, me } = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth");
const {
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_MS,
} = require("../config/env");

const router = Router();

// Slows down password guessing / mass sign-up attempts per client IP.
const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  limit: AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many attempts. Please wait a few minutes and try again.",
    code: "rate_limited",
  },
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", requireAuth, me);

module.exports = router;
