# Database Handoff — Waste Entries (MySQL via Sequelize)

> Adheeshana's `waste_entries` schema is integrated using **Option B**: Sequelize model + repository (same pattern as `Device`, `Capture`, `Alert`).

---

## Current architecture

```
/waste-update  →  POST /api/waste-entries
                         ↓
              WasteEntriesRepository
                         ↓
         ┌───────────────┴────────────────┐
         │ DATABASE_URL set?              │
         ▼ yes                            ▼ no (local dev)
   MySQL waste_entries table        backend/data/waste_entries.json
         │
         │ exportSnapshotForRetrain()
         ▼
   waste_entries.json snapshot  →  retrain_pipeline.py (local)
                                or  forecast-api POST /retrain (Railway)
```

| Component | Path |
|-----------|------|
| Sequelize model | `backend/models/WasteEntry.js` |
| Model registry | `backend/models/index.js` |
| Repository | `backend/repositories/wasteEntries.repository.js` |
| API routes | `backend/routes/wasteentries.routes.js` |
| SQL migration | `backend/migrations/20260901120000-create-waste-entries.js` |

---

## MySQL table schema

Created by migration or `DB_SYNC=true` on first boot:

```sql
CREATE TABLE waste_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entry_date DATE NOT NULL,
  vehicle_no VARCHAR(20) NOT NULL,
  location_id VARCHAR(100) NOT NULL,
  waste_type VARCHAR(100) NOT NULL,
  weight_kg DECIMAL(10,2) NOT NULL,
  submitted_at DATETIME NOT NULL,
  processed_for_training TINYINT(1) DEFAULT 0,
  INDEX idx_waste_entries_entry_date (entry_date),
  INDEX idx_waste_entries_location (location_id),
  INDEX idx_waste_entries_processed (processed_for_training)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Railway / production setup

### 1. MySQL database

Add a **MySQL** service on Railway (or external MySQL). Set on the **backend** service:

```env
DATABASE_URL=mysql://user:pass@host:3306/visionwaste
DB_SYNC=true
DB_SYNC_ALTER=false
```

Deploy once so tables are created (including `waste_entries`). Then set:

```env
DB_SYNC=false
```

### 2. Run migrations (alternative to DB_SYNC)

```powershell
cd backend
$env:DATABASE_URL = "mysql://..."
node scripts/migrate.js
```

### 3. Import existing JSON rows (automatic)

On startup, if `waste_entries` is **empty** but `backend/data/waste_entries.json` has rows, the backend **imports them once** into MySQL and refreshes the JSON snapshot for Python retrain.

Check logs for:

```text
[wasteEntries.repository] Imported N row(s) from JSON into waste_entries.
```

### 4. Verify storage mode

```http
GET /api/waste-entries/retrain-status
```

Response includes `"storage": "mysql"` when using the database.

---

## Local dev without MySQL

Leave `DATABASE_URL` empty. Repository uses `backend/data/waste_entries.json` (`"storage": "json"`).

---

## Retrain pipeline

Python retrain reads `backend/data/waste_entries.json` locally. On Railway, set `MODEL_FORECAST_URL` so retrain runs on **forecast-api** (`POST /retrain` with exported entries). Before retrain, the repository exports a fresh snapshot from MySQL via `exportSnapshotForRetrain()`.

Requires Python + xgboost on the machine running retrain, or run retrain in CI/local and deploy updated `waste_forecast/models/`.

---

## No changes needed in

- `frontend/src/pages/WasteUpdatePage.js`
- `backend/routes/wasteentries.routes.js` (uses repository only)
- `waste_forecast/src/retrain_pipeline.py` (reads JSON snapshot)
