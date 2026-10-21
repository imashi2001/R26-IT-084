const dashboardSettings = require("../services/dashboardSettingsService");
const audioSettingsService = require("../services/audioSettingsService");
const geminiSettingsService = require("../services/geminiSettingsService");
const geminiVisionService = require("../services/geminiVisionService");
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

function getAudioSettings(_req, res) {
  const settings = audioSettingsService.getSettings();
  return res.json({
    ...settings,
    builtin_labels: audioSettingsService.BUILTIN_LABELS,
    test_tracks: audioSettingsService.allTestTracks(settings),
    voice_policy_options: [
      {
        id: "classic",
        label: "Classic (timed)",
        summary:
          "First photo plays, same track may replay after 30s, mute after 60s (max 2). Safe for demos.",
      },
      {
        id: "quality",
        label: "Quality (change-based)",
        summary:
          "Plays when the prediction changes (correct vs illegal, etc.). Same scene is spam; after 60s only a different result plays. Thank-you without spam.",
      },
    ],
  });
}

function putAudioSettings(req, res) {
  try {
    const result = audioSettingsService.saveSettings(req.body);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    return res.json({
      ok: true,
      ...result.settings,
      builtin_labels: audioSettingsService.BUILTIN_LABELS,
      test_tracks: audioSettingsService.allTestTracks(result.settings),
      voice_policy_options: [
        {
          id: "classic",
          label: "Classic (timed)",
          summary:
            "First photo plays, same track may replay after 30s, mute after 60s (max 2). Safe for demos.",
        },
        {
          id: "quality",
          label: "Quality (change-based)",
          summary:
            "Plays when the prediction changes (correct vs illegal, etc.). Same scene is spam; after 60s only a different result plays. Thank-you without spam.",
        },
      ],
    });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: e.message });
    }
    return res.status(500).json({ error: e.message || "Could not save audio settings." });
  }
}

function getGeminiSettings(_req, res) {
  return res.json(geminiSettingsService.toPublicSettings());
}

function putGeminiSettings(req, res) {
  try {
    const result = geminiSettingsService.saveSettings(req.body);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    return res.json({ ok: true, ...result.settings });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: e.message });
    }
    return res
      .status(500)
      .json({ error: e.message || "Could not save Gemini settings." });
  }
}

/**
 * Admin: upload a test photo and run Gemini Vision (no ESP32 / no voice queue).
 * Saves result into last_prediction for the Settings panel.
 */
async function predictGeminiPhoto(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        error: "image file is required (multipart field: image)",
      });
    }
    const mime = (req.file.mimetype || "").toLowerCase();
    if (!mime.startsWith("image/")) {
      return res
        .status(400)
        .json({ error: "Upload must be an image (JPEG, PNG, or WebP)." });
    }

    const settings = geminiSettingsService.getSettings();
    const key = geminiSettingsService.resolveApiKey(settings);
    if (!key) {
      return res.status(400).json({
        error:
          "Gemini API key not configured. Save a key in Settings first.",
      });
    }

    const geminiResolved = await geminiVisionService.analyzeImage({
      imageBuffer: req.file.buffer,
      mimetype: req.file.mimetype || "image/jpeg",
      apiKey: key,
      model: settings.gemini_model,
    });

    const geminiOk =
      geminiResolved?.ok !== false && Boolean(geminiResolved?.scenario_key);
    const geminiPayload = {
      ok: geminiOk,
      scenario: geminiResolved?.scenario_key || null,
      label: geminiResolved?.label || null,
      track: geminiResolved?.track ?? null,
      confidence: geminiResolved?.confidence ?? null,
      fill_level: geminiResolved?.fill_level ?? null,
      litter_on_ground: geminiResolved?.litter_on_ground ?? false,
      animal_detected: geminiResolved?.animal_detected ?? false,
      reason: geminiResolved?.reason || null,
      error: geminiResolved?.error || null,
      inference_ms: geminiResolved?.inference_ms ?? null,
    };

    const final = geminiOk
      ? {
          scenario: geminiResolved.scenario_key,
          label: geminiResolved.label,
          track: geminiResolved.track,
          confidence: geminiResolved.confidence,
          winner: "gemini",
          source: "settings_test",
          reason: geminiResolved.reason,
        }
      : null;

    const last_prediction = {
      at: new Date().toISOString(),
      capture_id: null,
      event_id: null,
      motion_session_id: null,
      voice_source: settings.voice_source,
      source: "settings_upload",
      filename: req.file.originalname || null,
      yolo: null,
      gemini: geminiPayload,
      final,
    };

    geminiSettingsService.saveLastPrediction(last_prediction);

    return res.json({
      ok: geminiOk,
      gemini: geminiPayload,
      final,
      last_prediction,
      settings: geminiSettingsService.toPublicSettings(),
      error: geminiOk ? null : geminiPayload.error || "Gemini prediction failed",
    });
  } catch (e) {
    console.error("[gemini] settings photo predict failed:", e.message);
    return res
      .status(500)
      .json({ error: e.message || "Gemini prediction failed." });
  }
}

module.exports = {
  getSettings,
  uploadHero,
  deleteHero,
  uploadPromo,
  deletePromo,
  getAudioSettings,
  putAudioSettings,
  getGeminiSettings,
  putGeminiSettings,
  predictGeminiPhoto,
};
