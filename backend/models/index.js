/**
 * Registers all Sequelize models and their associations.
 *
 * Returns null when the database is not enabled (no DATABASE_URL).
 * Callers should use db.isDbEnabled() to gate persistence logic.
 */

const db = require("../config/db");

const defineUser = require("./User");
const defineDevice = require("./Device");
const defineCapture = require("./Capture");
const definePrediction = require("./Prediction");

let models = null;

function init() {
  if (models) return models;

  const sequelize = db.getSequelize();
  if (!sequelize) return null;

  const User = defineUser(sequelize);
  const Device = defineDevice(sequelize);
  const Capture = defineCapture(sequelize);
  const Prediction = definePrediction(sequelize);

  User.hasMany(Device, { foreignKey: "user_id", as: "devices" });
  Device.belongsTo(User, { foreignKey: "user_id", as: "user" });

  User.hasMany(Capture, { foreignKey: "user_id", as: "captures" });
  Capture.belongsTo(User, { foreignKey: "user_id", as: "user" });

  Device.hasMany(Capture, { foreignKey: "device_id", as: "captures" });
  Capture.belongsTo(Device, { foreignKey: "device_id", as: "device" });

  Capture.hasMany(Prediction, {
    foreignKey: "capture_id",
    as: "predictions",
    onDelete: "CASCADE",
  });
  Prediction.belongsTo(Capture, { foreignKey: "capture_id", as: "capture" });

  models = { sequelize, User, Device, Capture, Prediction };
  return models;
}

function getModels() {
  return models;
}

module.exports = { init, getModels };
