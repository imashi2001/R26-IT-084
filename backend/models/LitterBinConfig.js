const { DataTypes } = require("sequelize");

/**
 * Per-bin litter severity calibration: outline of the bin in that camera's view.
 * Points are fractions of the image size ([[x, y], ...] in 0–1) so the outline
 * survives camera resolution changes.
 */
module.exports = (sequelize) =>
  sequelize.define(
    "LitterBinConfig",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      device_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },
      bin_polygon: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      updated_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "litter_bin_configs",
      underscored: true,
      timestamps: true,
    }
  );
