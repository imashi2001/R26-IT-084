const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const JWT_SECRET = "test-secret-that-is-long-enough-1234";
const DEVICE_API_KEY = "device-key-abc";

/** Load middleware/auth.js with a specific environment (config is read at require time). */
function loadAuth(env) {
  const backendRoot = path.join(__dirname, "..");
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(path.join(backendRoot, "config")) || key.startsWith(path.join(backendRoot, "middleware"))) {
      delete require.cache[key];
    }
  }
  const saved = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  try {
    return require("../middleware/auth");
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function run(mw, req) {
  const res = mockRes();
  let nextCalled = false;
  mw({ headers: {}, query: {}, ...req }, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

describe("auth middleware", () => {
  let auth;
  let token;

  before(() => {
    auth = loadAuth({ JWT_SECRET, DEVICE_API_KEY });
    const jwt = require("jsonwebtoken");
    token = jwt.sign({ sub: 1, email: "a@b.c", role: "admin" }, JWT_SECRET);
  });

  it("requireAuth rejects missing token", () => {
    const { res, nextCalled } = run(auth.requireAuth, {});
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  it("requireAuth accepts a valid bearer token", () => {
    const req = { headers: { authorization: `Bearer ${token}` } };
    const { nextCalled } = run(auth.requireAuth, req);
    assert.equal(nextCalled, true);
  });

  it("requireAuth ignores ?token= but requireAuthAllowQuery accepts it", () => {
    const req = { query: { token } };
    assert.equal(run(auth.requireAuth, req).nextCalled, false);
    assert.equal(run(auth.requireAuthAllowQuery, req).nextCalled, true);
  });

  it("requireDevice accepts the device key", () => {
    const req = { headers: { "x-device-key": DEVICE_API_KEY } };
    assert.equal(run(auth.requireDevice, req).nextCalled, true);
  });

  it("requireDevice rejects a wrong device key", () => {
    const req = { headers: { "x-device-key": "nope" } };
    const { res, nextCalled } = run(auth.requireDevice, req);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  it("requireDevice accepts a logged-in user instead of a device key", () => {
    const req = { headers: { authorization: `Bearer ${token}` } };
    assert.equal(run(auth.requireDevice, req).nextCalled, true);
  });

  it("requireDevice stays open when DEVICE_API_KEY is unset", () => {
    const openAuth = loadAuth({ JWT_SECRET, DEVICE_API_KEY: "" });
    assert.equal(run(openAuth.requireDevice, {}).nextCalled, true);
  });

  it("requireRole blocks non-admins", () => {
    const { res, nextCalled } = run(auth.requireRole("admin"), {
      user: { id: 2, role: "viewer" },
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });
});
