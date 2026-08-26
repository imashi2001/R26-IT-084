/**
 * Sequelize connection helper.
 *
 * The backend works in two modes:
 *  - WITH a database  -> set DATABASE_URL (e.g. Railway Postgres)
 *  - WITHOUT a database -> leave DATABASE_URL empty; persistence features
 *    (capture history) are silently skipped, /predict still works.
 *
 * This makes it safe to run locally without Postgres while still letting
 * production save captures to Railway Postgres.
 */

const { Sequelize } = require("sequelize");

const { DATABASE_URL, DB_LOGGING, IS_PROD } = require("./env");

let sequelize = null;
let isEnabled = false;

if (DATABASE_URL) {
  sequelize = new Sequelize(DATABASE_URL, {
    dialect: "mysql",
    logging: DB_LOGGING ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });
  isEnabled = true;
}

function getSequelize() {
  return sequelize;
}

function isDbEnabled() {
  return isEnabled;
}

async function connect() {
  if (!sequelize) {
    console.warn(
      "[db] DATABASE_URL not set - persistence disabled (predict still works)."
    );
    return false;
  }

  try {
    await sequelize.authenticate();
    console.log("[db] connected to MySQL.");
    return true;
  } catch (err) {
    console.error("[db] failed to connect:", err.message);
    isEnabled = false;
    return false;
  }
}

module.exports = {
  getSequelize,
  isDbEnabled,
  connect,
};
