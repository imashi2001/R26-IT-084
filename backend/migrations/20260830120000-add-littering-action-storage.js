"use strict";

/** @type {import('sequelize').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("captures", "littering_event_detected", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
    await queryInterface.addColumn("captures", "littering_event_count", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn("captures", "littering_max_confidence", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn("captures", "littering_action_summary", {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    await queryInterface.addColumn("predictions", "model_type", {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("captures", "littering_event_detected");
    await queryInterface.removeColumn("captures", "littering_event_count");
    await queryInterface.removeColumn("captures", "littering_max_confidence");
    await queryInterface.removeColumn("captures", "littering_action_summary");
    await queryInterface.removeColumn("predictions", "model_type");
  },
};
