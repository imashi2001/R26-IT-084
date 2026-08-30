/**
 * Run Sequelize migrations (SQL files in backend/migrations).
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/migrate.js
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Sequelize } = require("sequelize");

const { DATABASE_URL, IS_PROD } = require("../config/env");

async function main() {
  if (!DATABASE_URL) {
    console.error("[migrate] DATABASE_URL is required.");
    process.exit(1);
  }

  const sequelize = new Sequelize(DATABASE_URL, {
    dialect: "postgres",
    logging: console.log,
    dialectOptions: IS_PROD
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
  });

  const migrationsDir = path.join(__dirname, "..", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".js"))
    .sort();

  await sequelize.getQueryInterface().createTable("sequelize_meta", {
    name: { type: Sequelize.STRING(255), allowNull: false, primaryKey: true },
  }).catch(() => {});

  const [appliedRows] = await sequelize.query(
    'SELECT name FROM "sequelize_meta" ORDER BY name'
  );
  const applied = new Set(appliedRows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] skip ${file}`);
      continue;
    }
    const migration = require(path.join(migrationsDir, file));
    console.log(`[migrate] up ${file}`);
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    await sequelize.query('INSERT INTO "sequelize_meta" (name) VALUES (:name)', {
      replacements: { name: file },
    });
  }

  await sequelize.close();
  console.log("[migrate] done");
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
