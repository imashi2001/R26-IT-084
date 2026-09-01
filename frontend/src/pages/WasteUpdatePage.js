import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Truck,
  MapPin,
  Tag,
  Weight,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Layers,
  Database,
  Edit3,
  Trash2,
  X,
  Search,
  Save,
} from "lucide-react";
import { apiUrl } from "../utils/apiBase";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PageShell from "../components/dashboard/PageShell";
import PageHeader from "../components/dashboard/PageHeader";
import Card from "../components/dashboard/Card";
import { btnPrimary, btnSecondary, btnGhost, inputClass, selectClass, labelClass, bannerTone } from "../components/dashboard/dashboardUi";
import "./WasteUpdatePage.css";

const LOCATIONS = [
  { id: "dehiwala-mtlavinia", name: "Dehiwala - Mt Lavinia" },
  { id: "moratuwa-mc", name: "Moratuwa M.C." },
  { id: "kotte-mc", name: "Sri J,puraKotte M.C." },
  { id: "maharagama-uc", name: "Maharagama U.C." },
  { id: "kesbewa-uc", name: "Kesbewa U.C." },
  { id: "boralesgamuwa-uc", name: "Boralesgamuwa U.C." },
  { id: "homagama-ps", name: "Homagama P.S." },
  { id: "kdu-campus", name: "Kothalawala Defence University" },
];

const CATEGORIES = [
  "Burnable",
  "SOW",
  "Unburnable",
  "Sanitary Waste",
  "Bulky Waste",
  "C & D",
  "Industrial Waste",
  "Slaughter House Waste",
];

const VEHICLE_REGEX = /^[A-Za-z0-9]{2,3} \d{4}$/;

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function WasteUpdatePage() {
  const navigate = useNavigate();

  // New Entry Form State
  const [date, setDate] = useState(getTodayString());
  const [vehicleNo, setVehicleNo] = useState("");
  const [locationId, setLocationId] = useState(LOCATIONS[0].id);
  const [wasteType, setWasteType] = useState(CATEGORIES[0]);
  const [weightKg, setWeightKg] = useState("");

  const [vehicleError, setVehicleError] = useState("");
  const [weightWarning, setWeightWarning] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [formError, setFormError] = useState("");

  // Retrain Status State
  const [retrainStatus, setRetrainStatus] = useState(null);
  const [retraining, setRetraining] = useState(false);

  // Past Data View Modal State
  const [showPastDataModal, setShowPastDataModal] = useState(false);
  const [pastEntries, setPastEntries] = useState([]);
  const [loadingPastData, setLoadingPastData] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editVehicleError, setEditVehicleError] = useState("");
  const [crudMessage, setCrudMessage] = useState(null);

  const fetchRetrainStatus = async () => {
    try {
      const res = await fetch(apiUrl("/api/waste-entries/retrain-status"));
      if (res.ok) {
        setRetrainStatus(await res.json());
      }
    } catch (err) {
      console.error("Failed to load retrain status:", err);
    }
  };

  const fetchPastEntries = useCallback(async () => {
    setLoadingPastData(true);
    try {
      const res = await fetch(apiUrl("/api/waste-entries?limit=100"));
      if (res.ok) {
        const data = await res.json();
        setPastEntries(data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch past entries:", err);
    } finally {
      setLoadingPastData(false);
    }
  }, []);

  useEffect(() => {
    fetchRetrainStatus();
  }, []);

  useEffect(() => {
    if (showPastDataModal) {
      fetchPastEntries();
    }
  }, [showPastDataModal, fetchPastEntries]);

  const handleVehicleChange = (val) => {
    setVehicleNo(val);
    if (val && !VEHICLE_REGEX.test(val.trim())) {
      setVehicleError("Format required: 2-3 alphanumeric chars, a space, then 4 digits (e.g. 251 5678, HW 3628, ACC 2657)");
    } else {
      setVehicleError("");
    }
  };

  const handleWeightChange = (val) => {
    setWeightKg(val);
    const num = Number(val);
    if (num > 10000) {
      setWeightWarning("Warning: Implausibly large weight (>10,000 kg). Please verify entry.");
    } else {
      setWeightWarning("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitSuccess(null);
    setFormError("");

    if (!VEHICLE_REGEX.test(vehicleNo.trim())) {
      setVehicleError("Format required: 2-3 alphanumeric chars, a space, then 4 digits (e.g. 251 5678, HW 3628, ACC 2657)");
      return;
    }

    const wNum = Number(weightKg);
    if (!wNum || wNum <= 0) {
      setFormError("Please enter a valid positive weight in kilograms.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(apiUrl("/api/waste-entries"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_date: date,
          vehicle_no: vehicleNo.trim(),
          location_id: locationId,
          waste_type: wasteType,
          weight_kg: wNum,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      }

      setSubmitSuccess(`Entry #${data.record.id} saved successfully! (${data.record.vehicle_no} · ${data.record.weight_kg} kg)`);
      setVehicleNo("");
      setWeightKg("");
      setVehicleError("");
      setWeightWarning("");
      fetchRetrainStatus();
      if (showPastDataModal) fetchPastEntries();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriggerRetrain = async () => {
    setRetraining(true);
    try {
      const res = await fetch(apiUrl("/api/waste-entries/trigger-retrain"), { method: "POST" });
      if (res.ok) {
        fetchRetrainStatus();
      }
    } catch (err) {
      console.error("Retrain trigger failed:", err);
    } finally {
      setRetraining(false);
    }
  };

  // CRUD Actions
  const handleStartEdit = (entry) => {
    setEditingId(entry.id);
    setEditForm({
      entry_date: entry.entry_date,
      vehicle_no: entry.vehicle_no,
      location_id: entry.location_id,
      waste_type: entry.waste_type,
      weight_kg: entry.weight_kg,
    });
    setEditVehicleError("");
  };

  const handleSaveEdit = async (id) => {
    if (editForm.vehicle_no && !VEHICLE_REGEX.test(editForm.vehicle_no.trim())) {
      setEditVehicleError("Valid format required: e.g. HW 3628, 251 5678");
      return;
    }

    try {
      const res = await fetch(apiUrl(`/api/waste-entries/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      setCrudMessage({ type: "success", text: `Entry #${id} updated successfully.` });
      setEditingId(null);
      fetchPastEntries();
      fetchRetrainStatus();
    } catch (err) {
      setCrudMessage({ type: "error", text: err.message });
    }
  };

  const handleDeleteEntry = async (id) => {
    if (!window.confirm(`Are you sure you want to delete Waste Entry #${id}?`)) return;

    try {
      const res = await fetch(apiUrl(`/api/waste-entries/${id}`), { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");

      setCrudMessage({ type: "success", text: `Entry #${id} deleted successfully.` });
      fetchPastEntries();
      fetchRetrainStatus();
    } catch (err) {
      setCrudMessage({ type: "error", text: err.message });
    }
  };

  const filteredEntries = pastEntries.filter((e) => {
    const q = searchQuery.toLowerCase();
    const locName = (LOCATIONS.find((l) => l.id === e.location_id)?.name || e.location_id).toLowerCase();
    return (
      e.vehicle_no.toLowerCase().includes(q) ||
      locName.includes(q) ||
      e.waste_type.toLowerCase().includes(q) ||
      e.entry_date.includes(q)
    );
  });

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          title="Waste Entry & Retraining"
          subtitle="Record daily collection logs · validation-gated model updates"
          actions={
            <>
              <button type="button" className={btnGhost} onClick={() => navigate("/forecast")}>
                <ArrowLeft className="h-4 w-4" />
                Back to Forecast
              </button>
              <button type="button" className={btnSecondary} onClick={() => setShowPastDataModal(true)}>
                <Database className="h-4 w-4 text-brand-400" />
                View Past Data
              </button>
            </>
          }
        />

      <div className="wup-content wup-content-themed">
        {/* Main Form Section */}
        <div className="wup-card wup-form-card">
          <div className="wup-card-title">
            <Layers size={18} style={{ color: "#67e8f9" }} />
            <h3>Log Daily Collection Entry</h3>
          </div>

          {submitSuccess && (
            <div className="wup-banner wup-success">
              <CheckCircle size={18} />
              <span>{submitSuccess}</span>
            </div>
          )}

          {formError && (
            <div className="wup-banner wup-error">
              <AlertTriangle size={18} />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="wup-form">
            {/* Row 1: Date & Vehicle */}
            <div className="wup-form-row">
              <div className="wup-field">
                <label>
                  <Calendar size={14} style={{ color: "#67e8f9" }} />
                  <span>Entry Date</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="wup-input"
                  required
                />
              </div>

              <div className="wup-field">
                <label>
                  <Truck size={14} style={{ color: "#67e8f9" }} />
                  <span>Vehicle No.</span>
                </label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  placeholder="e.g. HW 3628, 251 5678, ACC 2657"
                  className={`wup-input ${vehicleError ? "wup-input-invalid" : ""}`}
                  required
                />
                {vehicleError && <div className="wup-field-error">{vehicleError}</div>}
              </div>
            </div>

            {/* Row 2: Location & Waste Type */}
            <div className="wup-form-row">
              <div className="wup-field">
                <label>
                  <MapPin size={14} style={{ color: "#67e8f9" }} />
                  <span>Waste Source Location</span>
                </label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="wup-select"
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="wup-field">
                <label>
                  <Tag size={14} style={{ color: "#67e8f9" }} />
                  <span>Waste Type</span>
                </label>
                <select
                  value={wasteType}
                  onChange={(e) => setWasteType(e.target.value)}
                  className="wup-select"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: Weight */}
            <div className="wup-form-row">
              <div className="wup-field">
                <label>
                  <Weight size={14} style={{ color: "#67e8f9" }} />
                  <span>Weight (kg)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={weightKg}
                  onChange={(e) => handleWeightChange(e.target.value)}
                  placeholder="Enter weight in kilograms (e.g. 450.5)"
                  className="wup-input"
                  required
                />
                {weightWarning && <div className="wup-field-warning">{weightWarning}</div>}
              </div>
            </div>

            <button type="submit" className="wup-submit-btn" disabled={submitting || !!vehicleError}>
              {submitting ? "Saving Entry..." : "Submit Collection Log"}
            </button>
          </form>
        </div>

        {/* Retraining & Model Status Sidebar Widget */}
        <div className="wup-sidebar">
          <div className="wup-card wup-status-card">
            <div className="wup-card-title">
              <Cpu size={18} style={{ color: "#fbbf24" }} />
              <h3>Model Version & Retraining</h3>
            </div>

            <div className="wup-status-stat">
              <div className="wup-stat-label">Active Model Version</div>
              <div className="wup-stat-value" style={{ color: "#67e8f9" }}>
                {retrainStatus?.currentVersion || "v1.0"}
              </div>
            </div>

            <div className="wup-status-stat">
              <div className="wup-stat-label">Retrain Batch Progress</div>
              <div className="wup-stat-value">
                {retrainStatus?.unprocessedCount || 0} / {retrainStatus?.threshold || 30} entries
              </div>
              <div className="wup-progress-bar">
                <div
                  className="wup-progress-fill"
                  style={{ width: `${Math.min(100, ((retrainStatus?.unprocessedCount || 0) / 30) * 100)}%` }}
                />
              </div>
            </div>

            {retrainStatus?.latestRun && (
              <div className="wup-run-box">
                <div className="wup-run-title">Last Retrain Run</div>
                <div className="wup-run-outcome" style={{ color: retrainStatus.latestRun.promoted ? "#34d399" : "#fbbf24" }}>
                  {retrainStatus.latestRun.outcome}
                </div>
                <div className="wup-run-detail">
                  Live RMSE: {retrainStatus.latestRun.liveRmse} · Candidate RMSE: {retrainStatus.latestRun.candidateRmse}
                </div>
              </div>
            )}

            <button
              className="wup-retrain-btn"
              onClick={handleTriggerRetrain}
              disabled={retraining}
            >
              <RefreshCw size={14} className={retraining ? "wup-spin" : ""} />
              <span>{retraining ? "Running Retrain..." : "Trigger Manual Retrain"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── PAST DATA VIEW MODAL (CRUD) ── */}
      {showPastDataModal && (
        <div className="wup-modal-backdrop" onClick={() => setShowPastDataModal(false)}>
          <div className="wup-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="wup-modal-header">
              <div className="wup-modal-title">
                <Database size={20} style={{ color: "#67e8f9" }} />
                <h2>Past Waste Collection Entries</h2>
              </div>
              <button className="wup-close-btn" onClick={() => setShowPastDataModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="wup-modal-body">
              {crudMessage && (
                <div className={`wup-banner ${crudMessage.type === "success" ? "wup-success" : "wup-error"}`}>
                  <span>{crudMessage.text}</span>
                  <button className="wup-banner-close" onClick={() => setCrudMessage(null)}>
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Search Bar */}
              <div className="wup-modal-controls">
                <div className="wup-search-box">
                  <Search size={14} style={{ color: "#94a3b8" }} />
                  <input
                    type="text"
                    placeholder="Search by vehicle no, location, waste type, or date..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <span className="wup-count-tag">{filteredEntries.length} entries</span>
              </div>

              {/* Table */}
              {loadingPastData ? (
                <div className="wup-modal-loading">Loading collection records...</div>
              ) : filteredEntries.length === 0 ? (
                <div className="wup-modal-empty">No waste collection entries found.</div>
              ) : (
                <div className="wup-table-wrapper">
                  <table className="wup-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Date</th>
                        <th>Vehicle No.</th>
                        <th>Location</th>
                        <th>Category</th>
                        <th>Weight (kg)</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry) => {
                        const isEditing = editingId === entry.id;
                        const locName = LOCATIONS.find((l) => l.id === entry.location_id)?.name || entry.location_id;

                        if (isEditing) {
                          return (
                            <tr key={entry.id} className="wup-row-editing">
                              <td>#{entry.id}</td>
                              <td>
                                <input
                                  type="date"
                                  value={editForm.entry_date}
                                  onChange={(e) => setEditForm({ ...editForm, entry_date: e.target.value })}
                                  className="wup-edit-input"
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={editForm.vehicle_no}
                                  onChange={(e) => {
                                    setEditForm({ ...editForm, vehicle_no: e.target.value });
                                    setEditVehicleError("");
                                  }}
                                  className="wup-edit-input"
                                />
                                {editVehicleError && <div className="wup-edit-error">{editVehicleError}</div>}
                              </td>
                              <td>
                                <select
                                  value={editForm.location_id}
                                  onChange={(e) => setEditForm({ ...editForm, location_id: e.target.value })}
                                  className="wup-edit-select"
                                >
                                  {LOCATIONS.map((l) => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <select
                                  value={editForm.waste_type}
                                  onChange={(e) => setEditForm({ ...editForm, waste_type: e.target.value })}
                                  className="wup-edit-select"
                                >
                                  {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={editForm.weight_kg}
                                  onChange={(e) => setEditForm({ ...editForm, weight_kg: e.target.value })}
                                  className="wup-edit-input"
                                  style={{ width: "90px" }}
                                />
                              </td>
                              <td className="wup-actions-cell">
                                <button className="wup-save-btn" onClick={() => handleSaveEdit(entry.id)} title="Save">
                                  <Save size={14} />
                                </button>
                                <button className="wup-cancel-btn" onClick={() => setEditingId(null)} title="Cancel">
                                  <X size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={entry.id}>
                            <td>#{entry.id}</td>
                            <td>{entry.entry_date}</td>
                            <td><span className="wup-vehicle-badge">{entry.vehicle_no}</span></td>
                            <td>{locName}</td>
                            <td><span className="wup-category-badge">{entry.waste_type}</span></td>
                            <td><strong>{entry.weight_kg} kg</strong></td>
                            <td className="wup-actions-cell">
                              <button className="wup-action-icon edit" onClick={() => handleStartEdit(entry)} title="Edit Entry">
                                <Edit3 size={14} />
                              </button>
                              <button className="wup-action-icon delete" onClick={() => handleDeleteEntry(entry.id)} title="Delete Entry">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </PageShell>
    </DashboardLayout>
  );
}
