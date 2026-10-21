const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Prediction",
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
      label: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      confidence: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      box_x1: { type: DataTypes.FLOAT, allowNull: false },
      box_y1: { type: DataTypes.FLOAT, allowNull: false },
      box_x2: { type: DataTypes.FLOAT, allowNull: false },
      box_y2: { type: DataTypes.FLOAT, allowNull: false },
      model_type: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
    },
    {
      tableName: "predictions",
      underscored: true,
      timestamps: true,
    }
  );
