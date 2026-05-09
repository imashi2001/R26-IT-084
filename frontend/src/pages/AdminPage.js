import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../context/AuthContext";
import { apiUrl } from "../utils/apiBase";

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function AdminPage() {
  const { token, user, login, logout, authFetch } = useAuth();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState(null);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regInvite, setRegInvite] = useState("");
  const [regError, setRegError] = useState(null);

  const [devices, setDevices] = useState([]);
  const [devicesError, setDevicesError] = useState(null);

  const [name, setName] = useState("");
  const [esp32Id, setEsp32Id] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [geoQuery, setGeoQuery] = useState("");
  const [formMsg, setFormMsg] = useState(null);
  const [formError, setFormError] = useState(null);

  const mapCenter = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    return [7.8731, 80.7718];
  }, [latitude, longitude]);

  const loadDevices = useCallback(async () => {
    setDevicesError(null);
    try {
      const res = await fetch(apiUrl("/devices"));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setDevices(Array.isArray(body.devices) ? body.devices : []);
    } catch (e) {
      setDevicesError(e.message || "Could not load devices.");
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    if (token && user?.role === "admin") loadDevices();
  }, [token, user, loadDevices]);

  const onLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch(apiUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      login(body.token, body.user);
      setLoginPassword("");
    } catch (err) {
      setLoginError(err.message || "Login failed.");
    }
  };

  const onRegister = async (e) => {
    e.preventDefault();
    setRegError(null);
    try {
      const payload = {
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
      };
      if (regInvite.trim()) payload.adminInvite = regInvite.trim();

      const res = await fetch(apiUrl("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      login(body.token, body.user);
      setRegPassword("");
    } catch (err) {
      setRegError(err.message || "Registration failed.");
    }
  };

  const onGeocode = async () => {
    setFormError(null);
    setFormMsg(null);
    const q = geoQuery.trim();
    if (!q) return;
    try {
      const res = await fetch(apiUrl(`/geo/search?q=${encodeURIComponent(q)}`));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      const results = Array.isArray(body.results) ? body.results : [];
      if (!results.length) {
        setFormMsg("No results.");
        return;
      }
      const top = results[0];
      setLatitude(String(top.latitude));
      setLongitude(String(top.longitude));
      setFormMsg(`Pinned: ${top.label}`);
    } catch (err) {
      setFormError(err.message || "Geocode failed.");
    }
  };

  const onCreateDevice = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormMsg(null);

    const latRaw = latitude.trim();
    const lngRaw = longitude.trim();
    const lat = latRaw === "" ? null : Number(latRaw);
    const lng = lngRaw === "" ? null : Number(lngRaw);

    if ((lat !== null && !Number.isFinite(lat)) || (lng !== null && !Number.isFinite(lng))) {
      setFormError("Latitude and longitude must be valid numbers (or leave blank).");
      return;
    }

    if (!name.trim()) {
      setFormError("Name is required.");
      return;
    }

    try {
      const res = await authFetch("/devices", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          esp32_id: esp32Id.trim() || null,
          location: locationLabel.trim() || null,
          address: address.trim() || null,
          latitude: lat,
          longitude: lng,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setFormMsg(`Created bin #${body.id}`);
      setName("");
      setEsp32Id("");
      setLocationLabel("");
      setAddress("");
      setLatitude("");
      setLongitude("");
      loadDevices();
    } catch (err) {
      setFormError(err.message || "Create failed.");
    }
  };

  const isAdmin = user?.role === "admin";

  return (
    <div className="page admin-page">
      <header className="page-header">
        <h1>Admin — bins & locations</h1>
        <p className="subtitle">
          Create bins, set coordinates by clicking the map or searching an address.
          Match <code>esp32_id</code> with the laptop bridge <code>DEVICE_ESP32_ID</code>.
        </p>
      </header>

      {!token && (
        <section className="admin-card">
          <h2>Sign in</h2>
          <form className="admin-form" onSubmit={onLogin}>
            <label>
              Email
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {loginError && <div className="error-banner">{loginError}</div>}
            <button type="submit" className="btn btn-primary">
              Log in
            </button>
          </form>

          <h2 style={{ marginTop: 24 }}>Register</h2>
          <p className="subtitle">
            Include admin invite code from backend <code>ADMIN_INVITE_SECRET</code> to register as admin.
          </p>
          <form className="admin-form" onSubmit={onRegister}>
            <label>
              Name
              <input
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Password (min 6)
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>
            <label>
              Admin invite (optional)
              <input
                value={regInvite}
                onChange={(e) => setRegInvite(e.target.value)}
                placeholder="ADMIN_INVITE_SECRET value"
              />
            </label>
            {regError && <div className="error-banner">{regError}</div>}
            <button type="submit" className="btn btn-secondary">
              Register
            </button>
          </form>
        </section>
      )}

      {token && !isAdmin && (
        <div className="error-banner">
          Signed in as <strong>{user?.email}</strong> (role: {user?.role}). Admin role required to manage bins.{" "}
          <button type="button" className="btn btn-secondary" onClick={logout}>
            Log out
          </button>
        </div>
      )}

      {token && isAdmin && (
        <>
          <div className="admin-toolbar">
            <span>
              Signed in as <strong>{user.email}</strong>
            </span>
            <button type="button" className="btn btn-secondary" onClick={logout}>
              Log out
            </button>
            <button type="button" className="btn btn-primary" onClick={loadDevices}>
              Refresh list
            </button>
          </div>

          {devicesError && <div className="error-banner">{devicesError}</div>}

          <section className="admin-grid">
            <div className="admin-card">
              <h2>Add bin</h2>
              <form className="admin-form" onSubmit={onCreateDevice}>
                <label>
                  Name
                  <input value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                <label>
                  ESP32 ID (matches bridge)
                  <input value={esp32Id} onChange={(e) => setEsp32Id(e.target.value)} />
                </label>
                <label>
                  Location label
                  <input
                    value={locationLabel}
                    onChange={(e) => setLocationLabel(e.target.value)}
                    placeholder="e.g. Faculty gate"
                  />
                </label>
                <label>
                  Address
                  <input value={address} onChange={(e) => setAddress(e.target.value)} />
                </label>
                <div className="latlng-row">
                  <label>
                    Latitude
                    <input
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder="click map"
                    />
                  </label>
                  <label>
                    Longitude
                    <input
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder="click map"
                    />
                  </label>
                </div>
                <div className="geo-row">
                  <input
                    value={geoQuery}
                    onChange={(e) => setGeoQuery(e.target.value)}
                    placeholder="Search place (Nominatim)"
                  />
                  <button type="button" className="btn btn-secondary" onClick={onGeocode}>
                    Search
                  </button>
                </div>
                {formError && <div className="error-banner">{formError}</div>}
                {formMsg && <div className="info-banner">{formMsg}</div>}
                <button type="submit" className="btn btn-primary">
                  Save bin
                </button>
              </form>
            </div>

            <div className="admin-card map-picker-card">
              <h2>Pick on map</h2>
              <div className="map-frame admin-map">
                <MapContainer
                  center={mapCenter}
                  zoom={Number.isFinite(Number(latitude)) ? 16 : 7}
                  scrollWheelZoom
                  style={{ height: "320px", width: "100%", borderRadius: "12px" }}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapClickHandler
                    onPick={(lat, lng) => {
                      setLatitude(lat.toFixed(6));
                      setLongitude(lng.toFixed(6));
                    }}
                  />
                  {Number.isFinite(Number(latitude)) &&
                    Number.isFinite(Number(longitude)) && (
                      <CircleMarker
                        center={[Number(latitude), Number(longitude)]}
                        radius={10}
                        pathOptions={{
                          color: "#fff",
                          weight: 2,
                          fillColor: "#3949ab",
                          fillOpacity: 0.95,
                        }}
                      />
                    )}
                </MapContainer>
              </div>
            </div>
          </section>

          <section className="admin-card">
            <h2>Existing bins ({devices.length})</h2>
            <ul className="device-admin-list">
              {devices.map((d) => (
                <li key={d.id}>
                  <strong>{d.name}</strong> (#{d.id})
                  {d.esp32_id && (
                    <>
                      {" "}
                      <code>{d.esp32_id}</code>
                    </>
                  )}
                  <div className="device-admin-meta">
                    lat {d.latitude ?? "—"}, lng {d.longitude ?? "—"}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
