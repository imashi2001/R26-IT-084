/**
 * Turn Sequelize / Postgres BYTEA values into a Node Buffer.
 * toJSON() converts Buffer → { type: "Buffer", data: [...] }; Buffer.from(that) throws.
 */
function toNodeBuffer(buf) {
  if (!buf) return null;
  if (Buffer.isBuffer(buf)) return buf.length > 0 ? buf : null;
  if (buf instanceof Uint8Array) {
    return buf.byteLength > 0 ? Buffer.from(buf) : null;
  }
  if (buf.type === "Buffer" && Array.isArray(buf.data)) {
    return buf.data.length > 0 ? Buffer.from(buf.data) : null;
  }
  if (Array.isArray(buf)) {
    return buf.length > 0 ? Buffer.from(buf) : null;
  }
  if (typeof buf === "string" && buf.length > 0) {
    const hex = buf.startsWith("\\x") ? buf.slice(2) : buf;
    try {
      const fromHex = Buffer.from(hex, "hex");
      if (fromHex.length > 0) return fromHex;
    } catch {
      /* try base64 next */
    }
    try {
      const fromB64 = Buffer.from(buf, "base64");
      return fromB64.length > 0 ? fromB64 : null;
    } catch {
      return null;
    }
  }
  return null;
}

function captureHasImage(row) {
  if (!row) return false;
  if (row.has_image === true || row.has_image === 1 || row.has_image === "1") {
    return true;
  }
  if (toNodeBuffer(row.image_buffer)) return true;
  if (row.image_buffer === undefined) {
    return Boolean(row.image_mimetype || row.image_url || row.id);
  }
  return false;
}

module.exports = { toNodeBuffer, captureHasImage };
