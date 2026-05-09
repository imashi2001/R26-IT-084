/**
 * Resolves the backend API base URL for fetch calls.
 *
 * - Development: empty string → use relative URLs like "/predict" so CRA's
 *   package.json "proxy" forwards to localhost:5000 (no CORS hassle).
 * - Production: REACT_APP_API_URL must be set to the backend origin only,
 *   e.g. https://your-backend.up.railway.app (no trailing slash).
 *
 * ensureHttpsBase: if the env value is host-only (missing scheme), prepend https://
 * so the browser does not treat it as a relative path on the frontend origin.
 */

function ensureHttpsBase(raw) {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const hostPart = trimmed.split("/")[0];
  if (/^(localhost|127\.0\.0\.1|\[::1\])/i.test(hostPart)) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

export function getApiBaseUrl() {
  const fromEnv = ensureHttpsBase(process.env.REACT_APP_API_URL || "");

  if (process.env.NODE_ENV === "development") {
    return fromEnv || "";
  }

  return fromEnv || null;
}

/** Full URL for POST /predict */
export function getPredictUrl() {
  const base = getApiBaseUrl();
  if (base === null) return null;
  if (base === "") return "/predict";
  return `${base}/predict`;
}

/** True if base URL looks like "same host as this SPA" (classic mis-config → 405). */
export function isApiUrlPointingAtFrontend(baseUrl) {
  if (typeof window === "undefined" || !baseUrl) return false;
  try {
    const u = new URL(baseUrl);
    return (
      u.origin === window.location.origin ||
      `${u.protocol}//${u.host}` === window.location.origin
    );
  } catch {
    return false;
  }
}

/** Build absolute or proxied URL for any API path (leading slash optional). */
export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  if (base === null) {
    throw new Error(
      "API URL missing. Set REACT_APP_API_URL for production builds."
    );
  }
  if (base === "") return p;
  return `${base.replace(/\/+$/, "")}${p}`;
}
