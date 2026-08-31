"use strict";

/** @type {import('sequelize').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("captures", "litter_severity", {
      type: Sequelize.STRING(16),
      allowNull: true,
    });
    await queryInterface.addColumn("captures", "litter_lsi", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn("captures", "litter_detection_count", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn("captures", "litter_severity_summary", {
      type: Sequelize.JSONB,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("captures", "litter_severity");
    await queryInterface.removeColumn("captures", "litter_lsi");
    await queryInterface.removeColumn("captures", "litter_detection_count");
    await queryInterface.removeColumn("captures", "litter_severity_summary");
  },
};
