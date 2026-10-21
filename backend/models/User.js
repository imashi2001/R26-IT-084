const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(160),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM("user", "admin"),
        allowNull: false,
        defaultValue: "user",
      },

      // Municipal-admin profile fields (filled by the registration form).
      // Nullable at the DB level so an `alter` sync against an existing
      // users table doesn't fail; required at the controller level.
      admin_name: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      municipal_council: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      covered_area: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "users",
      underscored: true,
      timestamps: true,
    }
  );
