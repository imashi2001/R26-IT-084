import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  User as UserIcon,
  Mail,
  Lock,
  Building2,
  MapPin,
  Loader2,
  AlertCircle,
} from "lucide-react";
import axios from "axios";
import { apiUrl } from "../utils/apiBase";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/auth/AuthShell";
import { STAFF_HOME } from "../utils/authRoutes";

/**
 * Admin registration. The backend creates every account with role=admin.
 *
 * Fields (all required):
 *   - adminName        : full name of the municipal admin
 *   - email            : official council email
 *   - municipalCouncil : municipal council name (e.g. "Colombo MC")
 *   - coveredArea      : geographic area covered (free text)
 *   - password         : min 6 characters
 */
export default function RegisterPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    adminName: "",
    email: "",
    municipalCouncil: "",
    coveredArea: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (token) {
    return <Navigate to={STAFF_HOME} replace />;
  }

  function update(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        adminName: form.adminName.trim(),
        email: form.email.trim(),
        municipalCouncil: form.municipalCouncil.trim(),
        coveredArea: form.coveredArea.trim(),
        password: form.password,
      };
      const { data } = await axios.post(apiUrl("/auth/register"), payload);
      login(data.token, data.user);
      navigate(STAFF_HOME, { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Registration failed. Please try again.";
      if (status === 503) {
        setError(
          "Authentication is not configured on the server yet. Ask the deployer to set JWT_SECRET and DATABASE_URL."
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
      title="Register your council"
      subtitle="Create an admin account to start monitoring waste hygiene in your area."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-brand-700 hover:text-brand-600"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          id="adminName"
          label="Admin name"
          icon={UserIcon}
          required
          value={form.adminName}
          onChange={update("adminName")}
          placeholder="Jane Perera"
        />

        <Field
          id="email"
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="username"
          required
          value={form.email}
          onChange={update("email")}
          placeholder="admin@council.gov"
        />

        <Field
          id="municipalCouncil"
          label="Municipal council"
          icon={Building2}
          required
          value={form.municipalCouncil}
          onChange={update("municipalCouncil")}
          placeholder="Colombo Municipal Council"
        />

        <Field
          id="coveredArea"
          label="Covered area"
          icon={MapPin}
          required
          value={form.coveredArea}
          onChange={update("coveredArea")}
          placeholder="Wards 1–5, Colombo 03"
        />

        <Field
          id="password"
          label="Password"
          icon={Lock}
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          value={form.password}
          onChange={update("password")}
          placeholder="At least 6 characters"
        />

        <Field
          id="confirm"
          label="Confirm password"
          icon={Lock}
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          value={form.confirm}
          onChange={update("confirm")}
          placeholder="Repeat your password"
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
              Creating account…
            </>
          ) : (
            "Create admin account"
          )}
        </button>

        <p className="text-[11px] text-ink-400 leading-relaxed text-center">
          By registering, you confirm you are an authorised representative of
          the named council.
        </p>
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
