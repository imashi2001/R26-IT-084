const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/env");
const db = require("../config/db");
const modelsRegistry = require("../models");
const { assertJwtConfigured } = require("../middleware/auth");

function ensureModels() {
  if (!db.isDbEnabled()) return null;
  return modelsRegistry.getModels() || modelsRegistry.init();
}

function signToken(userRow) {
  assertJwtConfigured();
  // Keep the JWT payload small. Profile fields are returned alongside the
  // token in the response body and hydrated into the client's AuthContext;
  // the token only needs to identify the principal and their role.
  const payload = {
    sub: userRow.id,
    email: userRow.email,
    role: userRow.role,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function publicUser(userRow) {
  return {
    id: userRow.id,
    email: userRow.email,
    role: userRow.role,
    adminName: userRow.admin_name || userRow.name || null,
    name: userRow.name || userRow.admin_name || null,
    municipalCouncil: userRow.municipal_council || null,
    coveredArea: userRow.covered_area || null,
  };
}

/**
 * POST /auth/register
 *
 * Registers a municipal admin. All five profile fields are required:
 *   adminName, email, municipalCouncil, coveredArea, password
 *
 * Every registration is created with `role = "admin"`. There is no public
 * (non-admin) signup in this product; the dashboard is admin-only.
 */
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

    const {
      adminName,
      email,
      password,
      municipalCouncil,
      coveredArea,
    } = req.body || {};

    const trimmedEmail = (email || "").trim().toLowerCase();
    const trimmedName = (adminName || "").trim();
    const trimmedCouncil = (municipalCouncil || "").trim();
    const trimmedArea = (coveredArea || "").trim();

    if (
      !trimmedName ||
      !trimmedEmail ||
      !trimmedCouncil ||
      !trimmedArea ||
      !password
    ) {
      return res.status(400).json({
        error:
          "adminName, email, municipalCouncil, coveredArea, and password are required.",
      });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res
        .status(400)
        .json({ error: "password must be at least 6 characters" });
    }

    const { User } = models;

    const existing = await User.findOne({ where: { email: trimmedEmail } });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      // `name` stays populated for back-compat with any code (associations,
      // older controllers) that still reads the legacy column.
      name: trimmedName,
      admin_name: trimmedName,
      email: trimmedEmail,
      password_hash,
      role: "admin",
      municipal_council: trimmedCouncil,
      covered_area: trimmedArea,
    });

    const token = signToken(user);
    return res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /auth/login
 * Body: { email, password }
 */
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
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /auth/me  (requires Bearer JWT)
 *
 * Returns the authenticated admin's profile. Useful for re-hydrating the
 * AuthContext after a page refresh or for refreshing the user's council/
 * area after editing their profile in the future.
 */
async function me(req, res, next) {
  try {
    const models = ensureModels();
    if (!models) {
      return res.status(503).json({
        error:
          "Database not configured. Set DATABASE_URL on the backend service.",
      });
    }

    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { User } = models;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login, me };
