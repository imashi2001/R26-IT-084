"use strict";

/**
 * Normalize table names from Sequelize showAllTables (handles Postgres schema prefixes).
 */
function normalizeTableNames(tables) {
  return (tables || []).map((t) => {
    const raw = typeof t === "string" ? t : t.tableName || t.name || "";
    return String(raw).split(".").pop().toLowerCase();
  });
}

function hasTable(tables, name) {
  return normalizeTableNames(tables).includes(String(name).toLowerCase());
}

async function describeTableSafe(queryInterface, table) {
  try {
    return await queryInterface.describeTable(table);
  } catch {
    return null;
  }
}

async function addColumnIfNotExists(queryInterface, table, column, definition) {
  const desc = await describeTableSafe(queryInterface, table);
  if (!desc || desc[column]) {
    return false;
  }
  await queryInterface.addColumn(table, column, definition);
  return true;
}

async function removeColumnIfExists(queryInterface, table, column) {
  const desc = await describeTableSafe(queryInterface, table);
  if (!desc || !desc[column]) {
    return false;
  }
  await queryInterface.removeColumn(table, column);
  return true;
}

async function addIndexIfNotExists(queryInterface, table, fields, options = {}) {
  try {
    const indexes = await queryInterface.showIndex(table);
    const name = options.name;
    if (name && indexes.some((idx) => idx.name === name)) {
      return false;
    }
  } catch {
    /* showIndex may fail if table is new — try add below */
  }
  await queryInterface.addIndex(table, fields, options);
  return true;
}

module.exports = {
  normalizeTableNames,
  hasTable,
  addColumnIfNotExists,
  removeColumnIfExists,
  addIndexIfNotExists,
};
