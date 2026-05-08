const axios = require("axios");
const FormData = require("form-data");

const { MODEL_REGISTRY, INFER_TIMEOUT_MS } = require("../config/env");

function getModelUrl(modelName) {
  return MODEL_REGISTRY[modelName] || null;
}

function listModels() {
  return Object.keys(MODEL_REGISTRY);
}

async function pingAllModels() {
  const result = {};

  await Promise.all(
    Object.entries(MODEL_REGISTRY).map(async ([name, url]) => {
      try {
        const r = await axios.get(`${url}/health`, { timeout: 3000 });
        result[name] = { url, ok: true, status: r.status };
      } catch (err) {
        result[name] = { url, ok: false, error: err.message };
      }
    })
  );

  return result;
}

async function infer({ modelName, fileBuffer, filename, mimetype, conf }) {
  const base = getModelUrl(modelName);
  if (!base) {
    const err = new Error(
      `Unknown model '${modelName}'. Available: ${listModels().join(", ")}`
    );
    err.status = 400;
    throw err;
  }

  const form = new FormData();
  form.append("image", fileBuffer, {
    filename: filename || "upload.jpg",
    contentType: mimetype || "image/jpeg",
  });
  form.append("conf", String(conf ?? "0.25"));

  const targetUrl = `${base}/infer`;

  try {
    const r = await axios.post(targetUrl, form, {
      headers: form.getHeaders(),
      timeout: INFER_TIMEOUT_MS,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return (r.data && r.data.predictions) || [];
  } catch (err) {
    if (err.response) {
      const e = new Error(
        `Model service '${modelName}' returned ${err.response.status}.`
      );
      e.status = err.response.status;
      e.detail = err.response.data;
      throw e;
    }
    const e = new Error(
      `Could not reach model service '${modelName}' at ${targetUrl}.`
    );
    e.status = 502;
    e.detail = err.message;
    throw e;
  }
}

module.exports = {
  getModelUrl,
  listModels,
  pingAllModels,
  infer,
};
