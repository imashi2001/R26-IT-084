import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { apiUrl } from "../utils/apiBase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("vw_token") : null
  );
  const [user, setUser] = useState(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("vw_user");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  const login = useCallback((newToken, newUser) => {
    localStorage.setItem("vw_token", newToken);
    localStorage.setItem("vw_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("vw_token");
    localStorage.removeItem("vw_user");
    setToken(null);
    setUser(null);
  }, []);

  const authFetch = useCallback(
    async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      if (token) headers.set("Authorization", `Bearer ${token}`);
      if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers.has("Content-Type")
      ) {
        headers.set("Content-Type", "application/json");
      }
      return fetch(apiUrl(path), { ...options, headers });
    },
    [token]
  );

  const value = useMemo(
    () => ({
      token,
      user,
      login,
      logout,
      authFetch,
    }),
    [token, user, login, logout, authFetch]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
