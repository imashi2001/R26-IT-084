const dashboardSettings = require("../services/dashboardSettingsService");
const { getPublicBaseUrl } = require("../utils/publicUrl");

function filePublicUrl(req, filename, updatedAt) {
  const base = getPublicBaseUrl(req);
  const ts = encodeURIComponent(updatedAt || Date.now());
  return `${base}/uploads/dashboard/${filename}?t=${ts}`;
}

function heroPublicUrl(req) {
  const settings = dashboardSettings.getSettings();
  if (!settings.has_custom_hero) return null;
  return filePublicUrl(
    req,
    dashboardSettings.HERO_FILENAME,
    settings.hero_updated_at
  );
}

function promoPublicUrl(req) {
  const settings = dashboardSettings.getSettings();
  if (!settings.has_custom_promo) return null;
  return filePublicUrl(
    req,
    dashboardSettings.PROMO_FILENAME,
    settings.promo_updated_at
  );
}

function getSettings(req, res) {
  const settings = dashboardSettings.getSettings();
  return res.json({
    ...settings,
    hero_image_url: heroPublicUrl(req),
    promo_image_url: promoPublicUrl(req),
    default_hero: !settings.has_custom_hero,
    default_promo: !settings.has_custom_promo,
  });
}

function assertImageUpload(req, res) {
  if (!req.file || !req.file.buffer) {
    res
      .status(400)
      .json({ error: "image file is required (multipart field: image)" });
    return false;
  }
  const mime = (req.file.mimetype || "").toLowerCase();
  if (!mime.startsWith("image/")) {
    res
      .status(400)
      .json({ error: "Upload must be an image (JPEG, PNG, or WebP)." });
    return false;
  }
  return true;
}

function uploadHero(req, res) {
  if (!assertImageUpload(req, res)) return;
  const saved = dashboardSettings.saveHeroImage(req.file.buffer);
  return res.json({
    ok: true,
    hero_image_url: filePublicUrl(
      req,
      dashboardSettings.HERO_FILENAME,
      saved.hero_updated_at
    ),
    hero_updated_at: saved.hero_updated_at,
  });
}

function deleteHero(req, res) {
  dashboardSettings.removeHeroImage();
  return res.json({ ok: true, hero_image_url: null, default_hero: true });
}

function uploadPromo(req, res) {
  if (!assertImageUpload(req, res)) return;
  const saved = dashboardSettings.savePromoImage(req.file.buffer);
  return res.json({
    ok: true,
    promo_image_url: filePublicUrl(
      req,
      dashboardSettings.PROMO_FILENAME,
      saved.promo_updated_at
    ),
    promo_updated_at: saved.promo_updated_at,
  });
}

function deletePromo(req, res) {
  dashboardSettings.removePromoImage();
  return res.json({ ok: true, promo_image_url: null, default_promo: true });
}

module.exports = {
  getSettings,
  uploadHero,
  deleteHero,
  uploadPromo,
  deletePromo,
};
