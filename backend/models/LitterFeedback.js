const { DataTypes } = require("sequelize");

/**
 * Staff review of a litter model result on one capture.
 * model: "severity" (LSI level) | "action" (littering event).
 * verdict: "correct" | "incorrect".
 */
module.exports = (sequelize) =>
  sequelize.define(
    "LitterFeedback",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      capture_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      device_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      model: {
        type: DataTypes.STRING(16),
        allowNull: false,
      },
      verdict: {
        type: DataTypes.STRING(16),
        allowNull: false,
      },
      predicted_label: {
        type: DataTypes.STRING(16),
        allowNull: true,
      },
      corrected_label: {
        type: DataTypes.STRING(16),
        allowNull: true,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "litter_feedback",
      underscored: true,
      timestamps: true,
      indexes: [
        {
          name: "litter_feedback_capture_model_unique",
          unique: true,
          fields: ["capture_id", "model"],
        },
      ],
    }
  );
