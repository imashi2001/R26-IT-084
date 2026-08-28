const dashboardSettings = require("../services/dashboardSettingsService");
const { getPublicBaseUrl } = require("../utils/publicUrl");

function heroPublicUrl(req) {
  const base = getPublicBaseUrl(req);
  if (dashboardSettings.hasCustomHero()) {
    const ts = encodeURIComponent(
      dashboardSettings.getSettings().hero_updated_at || Date.now()
    );
    return `${base}/uploads/dashboard/${dashboardSettings.HERO_FILENAME}?t=${ts}`;
  }
  return null;
}

function getSettings(req, res) {
  const settings = dashboardSettings.getSettings();
  return res.json({
    ...settings,
    hero_image_url: heroPublicUrl(req),
    default_hero: !settings.has_custom_hero,
  });
}

function uploadHero(req, res) {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: "image file is required (multipart field: image)" });
  }
  const mime = (req.file.mimetype || "").toLowerCase();
  if (!mime.startsWith("image/")) {
    return res.status(400).json({ error: "Upload must be an image (JPEG, PNG, or WebP)." });
  }

  const saved = dashboardSettings.saveHeroImage(req.file.buffer);
  const ts = encodeURIComponent(saved.hero_updated_at || Date.now());
  const base = getPublicBaseUrl(req);
  return res.json({
    ok: true,
    hero_image_url: `${base}/uploads/dashboard/${dashboardSettings.HERO_FILENAME}?t=${ts}`,
    hero_updated_at: saved.hero_updated_at,
  });
}

function deleteHero(req, res) {
  dashboardSettings.removeHeroImage();
  return res.json({ ok: true, hero_image_url: null, default_hero: true });
}

function getHeroImage(req, res) {
  if (!dashboardSettings.hasCustomHero()) {
    return res.status(404).json({ error: "No custom hero image uploaded." });
  }
  res.set("Content-Type", "image/jpeg");
  res.set("Cache-Control", "public, max-age=3600");
  return res.sendFile(dashboardSettings.getHeroFilePath());
}

module.exports = { getSettings, uploadHero, deleteHero, getHeroImage };
