"use strict";

const { addColumnIfNotExists, removeColumnIfExists } = require("./_helpers");

/** @type {import('sequelize').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const jsonType =
      queryInterface.sequelize.getDialect() === "postgres"
        ? Sequelize.JSONB
        : Sequelize.JSON;

    await addColumnIfNotExists(queryInterface, "captures", "littering_event_detected", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
    await addColumnIfNotExists(queryInterface, "captures", "littering_event_count", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await addColumnIfNotExists(queryInterface, "captures", "littering_max_confidence", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await addColumnIfNotExists(queryInterface, "captures", "littering_action_summary", {
      type: jsonType,
      allowNull: true,
    });
    await addColumnIfNotExists(queryInterface, "predictions", "model_type", {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, "captures", "littering_event_detected");
    await removeColumnIfExists(queryInterface, "captures", "littering_event_count");
    await removeColumnIfExists(queryInterface, "captures", "littering_max_confidence");
    await removeColumnIfExists(queryInterface, "captures", "littering_action_summary");
    await removeColumnIfExists(queryInterface, "predictions", "model_type");
  },
};
