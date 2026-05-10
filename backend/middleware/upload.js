const multer = require("multer");
const { MAX_UPLOAD_BYTES } = require("../config/env");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

module.exports = upload;
