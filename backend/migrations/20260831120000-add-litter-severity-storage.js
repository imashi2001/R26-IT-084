"use strict";

const { addColumnIfNotExists, removeColumnIfExists } = require("./_helpers");

/** @type {import('sequelize').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const jsonType =
      queryInterface.sequelize.getDialect() === "postgres"
        ? Sequelize.JSONB
        : Sequelize.JSON;

    await addColumnIfNotExists(queryInterface, "captures", "litter_severity", {
      type: Sequelize.STRING(16),
      allowNull: true,
    });
    await addColumnIfNotExists(queryInterface, "captures", "litter_lsi", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await addColumnIfNotExists(queryInterface, "captures", "litter_detection_count", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await addColumnIfNotExists(queryInterface, "captures", "litter_severity_summary", {
      type: jsonType,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, "captures", "litter_severity");
    await removeColumnIfExists(queryInterface, "captures", "litter_lsi");
    await removeColumnIfExists(queryInterface, "captures", "litter_detection_count");
    await removeColumnIfExists(queryInterface, "captures", "litter_severity_summary");
  },
};
