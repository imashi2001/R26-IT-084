const { DataTypes } = require("sequelize");

/**
 * Capture row: base fields + optional hygienic-risk extras (waste/animal/weather/risk).
 */
module.exports = (sequelize) =>
  sequelize.define(
    "Capture",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      device_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      bridge_instance_id: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      image_url: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      image_buffer: {
        type: DataTypes.BLOB("medium"),
        allowNull: true,
      },
      image_mimetype: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      fill_level: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      model_name: {
        type: DataTypes.STRING(60),
        allowNull: false,
        defaultValue: "waste+animal",
      },
      captured_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      waste_label: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      waste_confidence: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      animal_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      risk_level: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      risk_case: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      rotting_hours: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      temp_c: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      humidity_pct: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      weather_condition: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },

      source_type: {
        type: DataTypes.STRING(16),
        allowNull: true,
      },
      latitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      fill_percentage: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      prediction_class: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
    },
    {
      tableName: "captures",
      underscored: true,
      timestamps: true,
      indexes: [{ fields: ["device_id", "captured_at"] }],
    }
  );
