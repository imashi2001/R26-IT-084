"use strict";

/** Infer Sequelize dialect from DATABASE_URL (Railway Postgres vs local MySQL). */
function resolveDialect(databaseUrl) {
  const url = String(databaseUrl || "").trim().toLowerCase();
  if (url.startsWith("postgres:") || url.startsWith("postgresql:")) {
    return "postgres";
  }
  return "mysql";
}

module.exports = { resolveDialect };
