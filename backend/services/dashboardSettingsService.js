const fs = require("fs");
const path = require("path");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "dashboard");
const META_PATH = path.join(UPLOAD_DIR, "settings.json");
const HERO_FILENAME = "hero.jpg";

function ensureDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function readMeta() {
  ensureDir();
  try {
    if (!fs.existsSync(META_PATH)) return {};
    return JSON.parse(fs.readFileSync(META_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeMeta(meta) {
  ensureDir();
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), "utf8");
}

function getHeroFilePath() {
  return path.join(UPLOAD_DIR, HERO_FILENAME);
}

function hasCustomHero() {
  return fs.existsSync(getHeroFilePath());
}

function getSettings() {
  const meta = readMeta();
  return {
    has_custom_hero: hasCustomHero(),
    hero_updated_at: meta.hero_updated_at || null,
    hero_filename: hasCustomHero() ? HERO_FILENAME : null,
  };
}

function saveHeroImage(buffer) {
  ensureDir();
  fs.writeFileSync(getHeroFilePath(), buffer);
  const updatedAt = new Date().toISOString();
  writeMeta({ hero_updated_at: updatedAt });
  return { hero_updated_at: updatedAt };
}

function removeHeroImage() {
  const p = getHeroFilePath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
  writeMeta({ hero_updated_at: null });
}

module.exports = {
  UPLOAD_DIR,
  HERO_FILENAME,
  getSettings,
  saveHeroImage,
  removeHeroImage,
  hasCustomHero,
  getHeroFilePath,
};
