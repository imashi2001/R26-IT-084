/**
 * ESP32 device command queue (PLAY_AUDIO / STOP_AUDIO).
 * Independent from laptop bridge pending_speaker_* fields.
 */

const { Op } = require("sequelize");

const db = require("../config/db");
const modelsRegistry = require("../models");

const ACTIVE_STATUSES = ["pending", "sent"];

function ensureModels() {
  if (!db.isDbEnabled()) return null;
  return modelsRegistry.getModels() || modelsRegistry.init();
}

function requireEsp32Id(device) {
  const esp32Id = device?.esp32_id ? String(device.esp32_id).trim() : "";
  if (!esp32Id) {
    const err = new Error("Device has no esp32_id");
    err.status = 400;
    throw err;
  }
  return esp32Id;
}

function toApiCommand(row) {
  if (!row) return null;
  const j = typeof row.toJSON === "function" ? row.toJSON() : row;
  return {
    command_id: j.id,
    device_id: j.device_id,
    esp32_id: j.esp32_id,
    command: j.command,
    track: j.track,
    status: j.status,
    created_at: j.created_at,
    sent_at: j.sent_at,
    completed_at: j.completed_at,
    error_message: j.error_message ?? null,
  };
}

/**
 * Cancel pending/sent commands so STOP (or a fresh command) is not stuck behind them.
 */
async function cancelActiveCommands(esp32Id, reason) {
  const models = ensureModels();
  if (!models) return 0;
  const { DeviceCommand } = models;
  const [count] = await DeviceCommand.update(
    {
      status: "failed",
      completed_at: new Date(),
      error_message: reason || "cancelled",
    },
    {
      where: {
        esp32_id: esp32Id,
        status: { [Op.in]: ACTIVE_STATUSES },
      },
    }
  );
  return count;
}

async function createPlayAudioCommand(device, { track = 1 } = {}) {
  const models = ensureModels();
  if (!models) return null;
  const { DeviceCommand } = models;

  const esp32Id = requireEsp32Id(device);

  const trackNum = Number.isFinite(Number(track)) ? Math.trunc(Number(track)) : 1;
  if (trackNum < 1 || trackNum > 9999) {
    const err = new Error("track must be an integer from 1 to 9999");
    err.status = 400;
    throw err;
  }

  const row = await DeviceCommand.create({
    device_id: device.id,
    esp32_id: esp32Id,
    command: "PLAY_AUDIO",
    track: trackNum,
    status: "pending",
    sent_at: null,
    completed_at: null,
    error_message: null,
  });

  return toApiCommand(row);
}

/**
 * Queue STOP_AUDIO. Cancels any pending/sent commands first so the ESP32
 * receives stop on the next poll (and stops current DFPlayer playback).
 */
async function createStopAudioCommand(device) {
  const models = ensureModels();
  if (!models) return null;
  const { DeviceCommand } = models;

  const esp32Id = requireEsp32Id(device);
  await cancelActiveCommands(esp32Id, "cancelled: stop requested");

  const row = await DeviceCommand.create({
    device_id: device.id,
    esp32_id: esp32Id,
    command: "STOP_AUDIO",
    track: null,
    status: "pending",
    sent_at: null,
    completed_at: null,
    error_message: null,
  });

  return toApiCommand(row);
}

/**
 * Touch last_seen_at and return the next pending/sent command for this ESP32.
 * Marks pending → sent on first delivery. Re-returns the same sent command
 * until ACK (no duplicates created).
 */
async function pollNextCommand(esp32IdRaw) {
  const models = ensureModels();
  if (!models) return { command: null, device: null };

  const { Device, DeviceCommand } = models;
  const esp32Id = String(esp32IdRaw || "").trim();
  if (!esp32Id) {
    const err = new Error("esp32_id query parameter is required");
    err.status = 400;
    throw err;
  }

  const device = await Device.findOne({ where: { esp32_id: esp32Id } });
  if (device) {
    await device.update({ last_seen_at: new Date() });
  }

  const row = await DeviceCommand.findOne({
    where: {
      esp32_id: esp32Id,
      status: { [Op.in]: ACTIVE_STATUSES },
    },
    order: [
      ["created_at", "ASC"],
      ["id", "ASC"],
    ],
  });

  if (!row) {
    return { command: null, device: device ? device.toJSON() : null };
  }

  if (row.status === "pending") {
    await row.update({
      status: "sent",
      sent_at: new Date(),
    });
    await row.reload();
  }

  return {
    command: {
      command_id: row.id,
      command: row.command,
      track: row.track,
    },
    device: device ? device.toJSON() : null,
  };
}

async function ackCommand(commandId, { esp32Id, status, errorMessage }) {
  const models = ensureModels();
  if (!models) return null;
  const { DeviceCommand } = models;

  const id = String(commandId || "").trim();
  if (!id) {
    const err = new Error("command_id is required");
    err.status = 400;
    throw err;
  }

  const esp32 = String(esp32Id || "").trim();
  if (!esp32) {
    const err = new Error("esp32_id is required");
    err.status = 400;
    throw err;
  }

  const st = String(status || "").trim().toLowerCase();
  if (st !== "completed" && st !== "failed") {
    const err = new Error('status must be "completed" or "failed"');
    err.status = 400;
    throw err;
  }

  const row = await DeviceCommand.findByPk(id);
  if (!row) {
    const err = new Error("Command not found");
    err.status = 404;
    throw err;
  }

  if (String(row.esp32_id).trim() !== esp32) {
    const err = new Error("esp32_id does not match this command");
    err.status = 403;
    throw err;
  }

  if (row.status === "completed" || row.status === "failed") {
    return toApiCommand(row);
  }

  const patch = {
    status: st,
    completed_at: new Date(),
  };
  if (st === "failed") {
    patch.error_message =
      errorMessage != null && String(errorMessage).trim()
        ? String(errorMessage).trim().slice(0, 2000)
        : null;
  } else {
    patch.error_message = null;
  }

  await row.update(patch);
  await row.reload();
  return toApiCommand(row);
}

async function getCommandById(commandId) {
  const models = ensureModels();
  if (!models) return null;
  const { DeviceCommand } = models;
  const row = await DeviceCommand.findByPk(String(commandId || "").trim());
  return row ? toApiCommand(row) : null;
}

module.exports = {
  createPlayAudioCommand,
  createStopAudioCommand,
  pollNextCommand,
  ackCommand,
  getCommandById,
  toApiCommand,
  ACTIVE_STATUSES,
};
