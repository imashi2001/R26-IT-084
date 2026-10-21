"use client";
import React from "react";
import { Navigate, useLocation } from "@/lib/react-router-compat";
import { useAuth } from "../../context/AuthContext";

/**
 * Gate any route behind a valid JWT token in AuthContext. When the user is
 * not signed in we redirect to /login and preserve the original target as
 * `state.from` so LoginPage can bounce them back after success.
 *
 * This is intentionally minimal — it does NOT call the backend to verify
 * the token, because the AuthContext only stores tokens issued by /auth/*.
 * If a stored token is invalid the next protected API call will return 401
 * and individual components handle that path themselves.
 */
export default function ProtectedRoute({ children }) {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
