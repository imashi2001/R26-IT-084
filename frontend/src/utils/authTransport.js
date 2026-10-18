/**
 * Attach the admin JWT to every request that goes to our backend API,
 * whether it is made with axios or window.fetch, and log the user out when
 * the backend says the session has expired.
 *
 * Requests to other origins (geocoders, ESP32 on the LAN, map tiles) never
 * receive the token.
 */

import axios from "axios";
import { getApiBaseUrl } from "./apiBase";

export const TOKEN_KEY = "vw_token";
export const AUTH_EXPIRED_EVENT = "vw:auth-expired";

export function getStoredToken() {
  try {
    return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

function apiOrigin() {
  const base = getApiBaseUrl();
  if (base === null || base === "") return window.location.origin;
  try {
    return new URL(base).origin;
  } catch {
    return window.location.origin;
  }
}

/** True when `url` (absolute or relative) points at the backend API. */
export function isApiRequest(url) {
  if (typeof window === "undefined" || !url) return false;
  try {
    const resolved = new URL(String(url), window.location.href);
    return resolved.origin === apiOrigin();
  } catch {
    return false;
  }
}

/**
 * Append ?token=<jwt> to an API image URL so <img src> / <a href> can load
 * protected capture images (browsers cannot send headers for those).
 */
export function withAuthToken(url) {
  const token = getStoredToken();
  if (!url || !token) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

function notifyIfExpired(status, body) {
  if (status !== 401 || !getStoredToken()) return;
  const code = body && typeof body === "object" ? body.code : null;
  if (code === "token_expired" || code === "token_invalid" || code === "token_error") {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
}

let installed = false;

export function installAuthTransport() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  axios.interceptors.request.use((config) => {
    const token = getStoredToken();
    const url = config.baseURL ? `${config.baseURL}${config.url || ""}` : config.url;
    if (token && isApiRequest(url)) {
      config.headers = config.headers || {};
      if (!config.headers.Authorization && !config.headers.authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  });

  axios.interceptors.response.use(
    (res) => res,
    (err) => {
      notifyIfExpired(err?.response?.status, err?.response?.data);
      return Promise.reject(err);
    }
  );

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" || input instanceof URL ? String(input) : input?.url;
    const token = getStoredToken();
    let nextInit = init;

    if (token && isApiRequest(url)) {
      const headers = new Headers(
        init.headers || (input instanceof Request ? input.headers : undefined)
      );
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      nextInit = { ...init, headers };
    }

    const res = await nativeFetch(input, nextInit);
    if (res.status === 401 && isApiRequest(url)) {
      res
        .clone()
        .json()
        .then((body) => notifyIfExpired(401, body))
        .catch(() => {});
    }
    return res;
  };
}
