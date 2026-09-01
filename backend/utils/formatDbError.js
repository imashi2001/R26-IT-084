"use strict";

function formatDbError(err) {
  if (!err) return "Unknown error";

  if (err.name === "SequelizeValidationError" && Array.isArray(err.errors) && err.errors.length) {
    return err.errors.map((e) => `${e.path}: ${e.message}`).join("; ");
  }

  if (err.name === "SequelizeUniqueConstraintError") {
    return err.message || "Duplicate entry.";
  }

  if (err.name === "SequelizeForeignKeyConstraintError") {
    return err.message || "Invalid reference.";
  }

  const parentMsg = err.parent?.detail || err.parent?.message;
  if (parentMsg) return parentMsg;

  if (err.message && err.message !== "Validation error") {
    return err.message;
  }

  return err.message || "Unknown error";
}

module.exports = { formatDbError };
