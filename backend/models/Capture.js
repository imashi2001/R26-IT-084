const { DataTypes } = require("sequelize");

/**
 * Capture row.
 *
 * Extends the test-branch base schema (image + fill_level + model_name) with
 * extra nullable columns for THIS component's outputs:
 *   - waste_label / waste_confidence  (MobileNetV2)
 *   - animal_count                    (YOLO detections that are animal class)
 *   - risk_level / risk_case          (rule-based engine)
 *   - rotting_hours                   (organic-only estimate)
 *   - temp_c / humidity_pct / weather_condition (weather snapshot used for risk)
 *
 * All extras default to null so old rows / no-DB mode don't break.
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

      // ---- extras owned by this component (Imashi) ----
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
    },
    {
      tableName: "captures",
      underscored: true,
      timestamps: true,
      indexes: [{ fields: ["device_id", "captured_at"] }],
    }
  );
