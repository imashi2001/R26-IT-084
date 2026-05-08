/**
 * Resolves the backend API base URL for fetch calls.
 *
 * - Development: empty string → use relative URLs like "/predict" so CRA's
 *   package.json "proxy" forwards to localhost:5000 (no CORS hassle).
 * - Production: REACT_APP_API_URL must be set to the backend origin only,
 *   e.g. https://your-backend.up.railway.app (no trailing slash).
 */

export function getApiBaseUrl() {
  const fromEnv = (process.env.REACT_APP_API_URL || "").trim().replace(/\/+$/, "");

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
