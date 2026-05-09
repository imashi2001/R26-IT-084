const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  ADMIN_INVITE_SECRET,
} = require("../config/env");
const db = require("../config/db");
const modelsRegistry = require("../models");
const { assertJwtConfigured } = require("../middleware/auth");

function ensureModels() {
  if (!db.isDbEnabled()) return null;
  return modelsRegistry.getModels() || modelsRegistry.init();
}

function signToken(userRow) {
  assertJwtConfigured();
  const payload = {
    sub: userRow.id,
    email: userRow.email,
    role: userRow.role,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

async function register(req, res, next) {
  try {
    const models = ensureModels();
    if (!models) {
      return res.status(503).json({
        error:
          "Database not configured. Set DATABASE_URL on the backend service.",
      });
    }
    assertJwtConfigured();

    const { name, email, password, adminInvite } = req.body || {};
    const trimmedEmail = (email || "").trim().toLowerCase();
    const trimmedName = (name || "").trim();

    if (!trimmedName || !trimmedEmail || !password) {
      return res.status(400).json({
        error: "name, email, and password are required",
      });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res
        .status(400)
        .json({ error: "password must be at least 6 characters" });
    }

    let role = "user";
    if (
      ADMIN_INVITE_SECRET &&
      adminInvite &&
      adminInvite === ADMIN_INVITE_SECRET
    ) {
      role = "admin";
    }

    const { User } = models;

    const existing = await User.findOne({ where: { email: trimmedEmail } });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: trimmedName,
      email: trimmedEmail,
      password_hash,
      role,
    });

    const token = signToken(user);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const models = ensureModels();
    if (!models) {
      return res.status(503).json({
        error:
          "Database not configured. Set DATABASE_URL on the backend service.",
      });
    }
    assertJwtConfigured();

    const { email, password } = req.body || {};
    const trimmedEmail = (email || "").trim().toLowerCase();

    if (!trimmedEmail || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const { User } = models;

    const user = await User.findOne({ where: { email: trimmedEmail } });
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login };
