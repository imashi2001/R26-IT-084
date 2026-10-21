const { DataTypes } = require("sequelize");

/**
 * Operational alert derived from captures (hygienic risk, animals, overflow)
 * or future manual sources. Admins update `status` + `admin_note` from the UI.
 */
module.exports = (sequelize) =>
  sequelize.define(
    "Alert",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      capture_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        unique: true,
        comment: "Source capture when alert is auto-generated",
      },
      device_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      alert_type: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      severity: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "warning",
      },
      title: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      summary: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "open",
      },
      admin_note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      resolved_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "alerts",
      underscored: true,
      timestamps: true,
      indexes: [
        { fields: ["status", "created_at"] },
        { fields: ["device_id", "created_at"] },
        { fields: ["severity", "created_at"] },
      ],
    }
  );
