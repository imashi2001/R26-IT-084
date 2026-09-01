# Database Handoff Documentation — Swapping Temporary Storage to MySQL

> **For Team Lead / Database Administrator**

This project currently uses a temporary repository pattern (`WasteEntriesRepository`) backed by a structured local database file (`backend/data/waste_entries.json`) that strictly adheres to the production **MySQL `waste_entries` table schema**.

---

## 1. Complete End-to-End Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User submits form at /waste-update                       │
│    Fields: date, vehicle_no, location_id, waste_type, kg   │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /api/waste-entries
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. WasteEntriesRepository.create(entryData)                 │
│    Saves record to waste_entries storage                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
            Trigger: Every N = 30 entries (or manual API)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Retraining Pipeline (retrain_pipeline.py)                 │
│    - Reads unprocessed entries via WasteEntriesRepository   │
│    - Aggregates daily KG by (year, month) into metric tons  │
│    - Trains candidate model (model_candidate.json)          │
│    - Evaluates Out-of-Fold RMSE against live model.json     │
│    - Auto-promotes only if Candidate RMSE <= Live * 1.02    │
│    - Logs outcome to model_registry.json                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Target MySQL Database Table Schema

When setting up your real MySQL database server, create the table using the following DDL:

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
  INDEX idx_entry_date (entry_date),
  INDEX idx_location (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 3. Swap Instructions (1-Step Change)

To connect the live backend to your production MySQL database:

1. Open [`backend/repositories/wasteEntries.repository.js`](file:///c:/Reasearch/SLIIT/R26-IT-084/backend/repositories/wasteEntries.repository.js).
2. Update the repository methods (`create`, `findAll`, `countStats`, `getUnprocessed`, `markProcessed`) to execute SQL queries using your preferred database connection pool (`mysql2` or `sequelize`):

```javascript
// Example replacement in wasteEntries.repository.js:
const dbPool = require('../config/db'); // MySQL connection pool

class WasteEntriesRepository {
  static async create(data) {
    const [result] = await dbPool.query(
      `INSERT INTO waste_entries (entry_date, vehicle_no, location_id, waste_type, weight_kg, submitted_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [data.entry_date, data.vehicle_no, data.location_id, data.waste_type, data.weight_kg]
    );
    return { id: result.insertId, ...data };
  }

  static async findAll(options) {
    const [rows] = await dbPool.query(`SELECT * FROM waste_entries ORDER BY submitted_at DESC LIMIT ? OFFSET ?`, [options.limit, options.offset]);
    return { items: rows };
  }
}
```

> **Note:** Zero lines of code under `backend/routes/`, `frontend/src/`, or `waste_forecast/` need to change. The entire data access boundary is encapsulated inside `WasteEntriesRepository`.
