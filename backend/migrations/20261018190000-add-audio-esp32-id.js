"use strict";

const { addColumnIfNotExists, removeColumnIfExists, addIndexIfNotExists } =
  require("./_helpers");

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfNotExists(queryInterface, "devices", "audio_esp32_id", {
      type: Sequelize.STRING(80),
      allowNull: true,
    });
    await addColumnIfNotExists(queryInterface, "devices", "audio_last_seen_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addIndexIfNotExists(queryInterface, "devices", ["audio_esp32_id"], {
      name: "devices_audio_esp32_id_unique",
      unique: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, "devices", "audio_last_seen_at");
    await removeColumnIfExists(queryInterface, "devices", "audio_esp32_id");
  },
};
