const fs = require("fs");
const path = require("path");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "dashboard");
const META_PATH = path.join(UPLOAD_DIR, "settings.json");
const HERO_FILENAME = "hero.jpg";
const PROMO_FILENAME = "promo.jpg";

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

function patchMeta(partial) {
  const next = { ...readMeta(), ...partial };
  ensureDir();
  fs.writeFileSync(META_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function getHeroFilePath() {
  return path.join(UPLOAD_DIR, HERO_FILENAME);
}

function getPromoFilePath() {
  return path.join(UPLOAD_DIR, PROMO_FILENAME);
}

function hasCustomHero() {
  return fs.existsSync(getHeroFilePath());
}

function hasCustomPromo() {
  return fs.existsSync(getPromoFilePath());
}

function getSettings() {
  const meta = readMeta();
  return {
    has_custom_hero: hasCustomHero(),
    hero_updated_at: meta.hero_updated_at || null,
    hero_filename: hasCustomHero() ? HERO_FILENAME : null,
    has_custom_promo: hasCustomPromo(),
    promo_updated_at: meta.promo_updated_at || null,
    promo_filename: hasCustomPromo() ? PROMO_FILENAME : null,
  };
}

function saveHeroImage(buffer) {
  ensureDir();
  fs.writeFileSync(getHeroFilePath(), buffer);
  const updatedAt = new Date().toISOString();
  patchMeta({ hero_updated_at: updatedAt });
  return { hero_updated_at: updatedAt };
}

function removeHeroImage() {
  const p = getHeroFilePath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
  patchMeta({ hero_updated_at: null });
}

function savePromoImage(buffer) {
  ensureDir();
  fs.writeFileSync(getPromoFilePath(), buffer);
  const updatedAt = new Date().toISOString();
  patchMeta({ promo_updated_at: updatedAt });
  return { promo_updated_at: updatedAt };
}

function removePromoImage() {
  const p = getPromoFilePath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
  patchMeta({ promo_updated_at: null });
}

module.exports = {
  UPLOAD_DIR,
  HERO_FILENAME,
  PROMO_FILENAME,
  getSettings,
  saveHeroImage,
  removeHeroImage,
  savePromoImage,
  removePromoImage,
  hasCustomHero,
  hasCustomPromo,
  getHeroFilePath,
  getPromoFilePath,
};
