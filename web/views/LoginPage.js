"use client";
import React, { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "@/lib/react-router-compat";
import { Mail, Lock, Loader2, AlertCircle } from "lucide-react";
import axios from "axios";
import { apiUrl } from "../utils/apiBase";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/auth/AuthShell";

/**
 * POST /auth/login -> { token, user }.
 * On success we hand the pair to AuthContext.login() (which persists to
 * localStorage) and bounce the admin to wherever they were trying to go
 * before being gated out, defaulting to /dashboard.
 */
export default function LoginPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fromPath =
    (location.state && location.state.from) || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (token) {
    return <Navigate to={fromPath} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data } = await axios.post(apiUrl("/auth/login"), {
        email: email.trim(),
        password,
      });
      login(data.token, data.user);
      navigate(fromPath, { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Login failed. Please try again.";
      if (status === 503) {
        setError(
          "Authentication is not configured on the server yet. Ask the admin to set JWT_SECRET and DATABASE_URL."
        );
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Sign in to VisionWaste"
      subtitle="Welcome back. Enter your credentials to access the dashboard."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            className="font-semibold text-brand-700 hover:text-brand-600"
          >
            Register your council
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          id="email"
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@council.gov"
        />

        <Field
          id="password"
          label="Password"
          icon={Lock}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        {error ? <ErrorBanner message={error} /> : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </AuthShell>
  );
}

function Field({ id, label, icon: Icon, ...rest }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-ink-700">{label}</span>
      <div className="mt-1.5 relative">
        {Icon ? (
          <Icon className="h-4 w-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        ) : null}
        <input
          id={id}
          {...rest}
          className={`block w-full rounded-lg border border-slate-300 bg-white py-2.5 ${
            Icon ? "pl-9" : "pl-3"
          } pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500`}
        />
      </div>
    </label>
  );
}

function ErrorBanner({ message }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
