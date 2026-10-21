"use strict";

const { hasTable, addIndexIfNotExists } = require("./_helpers");

/** @type {import('sequelize').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    if (!hasTable(tables, "litter_bin_configs")) {
      await queryInterface.createTable("litter_bin_configs", {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        device_id: { type: Sequelize.INTEGER, allowNull: false, unique: true },
        bin_polygon: { type: Sequelize.JSON, allowNull: true },
        updated_by_user_id: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    if (!hasTable(tables, "litter_feedback")) {
      await queryInterface.createTable("litter_feedback", {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        capture_id: { type: Sequelize.INTEGER, allowNull: false },
        device_id: { type: Sequelize.INTEGER, allowNull: true },
        model: { type: Sequelize.STRING(16), allowNull: false },
        verdict: { type: Sequelize.STRING(16), allowNull: false },
        predicted_label: { type: Sequelize.STRING(16), allowNull: true },
        corrected_label: { type: Sequelize.STRING(16), allowNull: true },
        note: { type: Sequelize.TEXT, allowNull: true },
        user_id: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    await addIndexIfNotExists(queryInterface, "litter_feedback", ["capture_id", "model"], {
      name: "litter_feedback_capture_model_unique",
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("litter_feedback").catch(() => {});
    await queryInterface.dropTable("litter_bin_configs").catch(() => {});
  },
};
