const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Device",
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
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      esp32_id: {
        type: DataTypes.STRING(80),
        allowNull: true,
        unique: true,
      },
      location: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      address: {
        type: DataTypes.STRING(255),
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
      bridge_instance_id: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "active",
      },
      /** LAN base URL for the camera, e.g. http://10.158.245.191 (no /capture). */
      camera_base_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      /** Queued bridge relay: test | alarm | null */
      pending_speaker_action: {
        type: DataTypes.STRING(16),
        allowNull: true,
      },
      pending_speaker_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "devices",
      underscored: true,
      timestamps: true,
    }
  );
