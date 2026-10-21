const { DEFAULT_MODEL } = require("../config/env");
const modelClient = require("../services/modelClient");
const db = require("../config/db");

async function getHealth(_req, res, next) {
  try {
    const models = await modelClient.pingAllModels();
    const littering_action = await modelClient.pingLitteringActionHealth();

    const database = db.isDbEnabled()
      ? await pingDb()
      : { enabled: false, ok: false };

    res.json({
      status: "ok",
      service: "backend",
      runtime: "express",
      default_model: DEFAULT_MODEL,
      models,
      littering_action,
      database,
    });
  } catch (err) {
    next(err);
  }
}

async function pingDb() {
  try {
    const sequelize = db.getSequelize();
    await sequelize.authenticate();
    return { enabled: true, ok: true };
  } catch (err) {
    return { enabled: true, ok: false, error: err.message };
  }
}

module.exports = { getHealth };
