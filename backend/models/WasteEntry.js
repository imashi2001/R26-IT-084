const { DataTypes } = require("sequelize");

/**
 * Municipal waste collection log (Adheeshana forecasting / retrain pipeline).
 * Matches README_DATABASE_HANDOFF.md MySQL DDL.
 */
module.exports = (sequelize) =>
  sequelize.define(
    "WasteEntry",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      entry_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      vehicle_no: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      location_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      waste_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      weight_kg: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      submitted_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      processed_for_training: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "waste_entries",
      underscored: true,
      timestamps: false,
      indexes: [
        { fields: ["entry_date"], name: "idx_waste_entries_entry_date" },
        { fields: ["location_id"], name: "idx_waste_entries_location" },
        { fields: ["processed_for_training"], name: "idx_waste_entries_processed" },
      ],
    }
  );
