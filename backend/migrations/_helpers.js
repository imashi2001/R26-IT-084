"use strict";

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

module.exports = {
  addColumnIfNotExists,
  removeColumnIfExists,
};
