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
      image_url: {
        type: DataTypes.TEXT,
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
    }
  );
