const { DataTypes } = require("sequelize");

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
        defaultValue: "yolo",
      },
      captured_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "captures",
      underscored: true,
      timestamps: true,
      indexes: [{ fields: ["device_id", "captured_at"] }],
    }
  );
