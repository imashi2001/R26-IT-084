const { DataTypes } = require("sequelize");

/**
 * Queued ESP32 commands (independent of laptop bridge speaker-pending).
 * PLAY_AUDIO + track N => DFPlayer /MP3/000N.mp3
 */
module.exports = (sequelize) =>
  sequelize.define(
    "DeviceCommand",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      device_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      esp32_id: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      command: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      track: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "pending",
      },
      sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "device_commands",
      underscored: true,
      timestamps: true,
    }
  );
