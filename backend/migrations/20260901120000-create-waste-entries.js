"use strict";

const { hasTable, addIndexIfNotExists } = require("./_helpers");

/** @type {import('sequelize').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (hasTable(tables, "waste_entries")) {
      return;
    }

    await queryInterface.createTable("waste_entries", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      entry_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      vehicle_no: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      location_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      waste_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      weight_kg: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      submitted_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      processed_for_training: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    });

    await addIndexIfNotExists(queryInterface, "waste_entries", ["entry_date"], {
      name: "idx_waste_entries_entry_date",
    });
    await addIndexIfNotExists(queryInterface, "waste_entries", ["location_id"], {
      name: "idx_waste_entries_location",
    });
    await addIndexIfNotExists(
      queryInterface,
      "waste_entries",
      ["processed_for_training"],
      {
        name: "idx_waste_entries_processed",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("waste_entries");
  },
};
