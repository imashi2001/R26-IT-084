# Contribution Details: Event-Aware Waste Demand Forecasting

This document provides an objective breakdown separating the individual contributions of the **"Event-Aware Waste Demand Forecasting"** component from shared and group contributions within the repository (`R26-IT-084`), based strictly on source code inspection and git commit history.

---

## 1. Backend and Database

### 1.1 Backend Framework
* **Primary Framework:** **Express.js (Node.js)**
* **Entry File & Folder:** 
  * Entry File: `backend/server.js` (with Express app configuration in `backend/app.js`)
  * Folder: `backend/`
* **Additional Model Microservices:**
  * Standalone Python inference microservices exist for other team members: `model-yolo/` (Flask, port 6000), Waste/Animal services (FastAPI, ports 8001/8002).
  * An earlier standalone Python Dash app prototype exists in `forecasting dashboard/` (`app.py`).

### 1.2 Database and Storage
* **Shared / Group Database:**
  * **Relational Database:** MySQL / PostgreSQL via Sequelize ORM
  * **Configuration / Connection File:** `backend/config/db.js` (connects via environment variable `DATABASE_URL` loaded from `backend/config/env.js`).
  * **Used For:** User authentication (`users`), IoT sensor telemetry (`devices`, `device_commands`), image detection history (`captures`), and operational notifications (`alerts`).
* **Forecasting Component Storage:**
  * **Data Entry Storage:** JSON file store located at `backend/data/waste_entries.json`.
  * **Data Access Layer:** `backend/repositories/wasteEntries.repository.js` (abstracts CRUD operations for waste dump records and calculates unprocessed batch counts).
  * **ML Model Artifacts & Registry:** `waste_forecast/models/` (`model.json`, `model_candidate.json`, `model_registry.json`, `daily_profile.json`, `feature_columns.json`, `trained_model_daily.pkl`).
  * **Calendar & Baseline Cache:** `backend/holiday_cache.json` (Sri Lankan holiday calendar cache), `backend/historical_baselines.json` (location-specific Q1, Median, Q3, P90 baselines), `backend/geocode_cache.json`.

### 1.3 Backend Architecture & Route Separation
The backend is a **shared Express.js API gateway** serving all components. There is no separate backend server for forecasting; instead, the forecasting component exposes dedicated modular route files registered inside `backend/routes/index.js`.

#### Component Route Ownership:
* **Event-Aware Waste Demand Forecasting (Your Individual Component):**
  * `backend/routes/wastedata.routes.js` (`/api/waste-data` — daily location KG forecasts & baseline status)
  * `backend/routes/wastetrend.routes.js` (`/api/waste-trend` — 7-day past + 7-day future forecast curve)
  * `backend/routes/wasteinsights.routes.js` (`/api/waste-insights` — seasonal peak and category insights)
  * `backend/routes/wasteentries.routes.js` (`/api/waste-entries` — CRUD entries and auto-retraining pipeline triggers)
* **Waste Bin Fill-Level & Multi-Model Inference (Shared / Teammates):**
  * `backend/routes/predict.routes.js` (`/predict` — multipart image inference)
  * `backend/routes/captures.routes.js` (`/captures` — capture history)
  * `backend/routes/latest.routes.js` (`/latest` — latest capture snapshot)
  * `backend/routes/bridge.routes.js` (`/bridge` — ESP32 bridge integration)
* **Litter Severity Detection (Shared / Teammates):**
  * `backend/routes/litter.routes.js` (`/litter-severity` — YOLO + LSI litter classification)
* **Hygienic Risk & Weather Timeline (Shared / Teammates):**
  * `backend/routes/forecast.routes.js` (`/forecast` — 24h weather-driven bin risk timeline via OpenWeather)
  * `backend/routes/weather.routes.js` (`/weather` — current ambient temperature/humidity)
* **IoT Devices & Animal Deterrent Audio (Shared / Teammates):**
  * `backend/routes/devices.routes.js` (`/devices` — device map & DFPlayer remote audio commands)
  * `backend/routes/alerts.routes.js` (`/alerts` — alert status workflows)
  * `backend/routes/geo.routes.js` (`/geo` — landmark geocoding)
* **Core Shared Infrastructure:**
  * `backend/routes/health.routes.js` (`/health`)
  * `backend/routes/auth.routes.js` (`/auth`)

---

## 2. Dashboard

### 2.1 Frontend Framework & Folder
* **Frontend Framework:** **React 18** with **Vite 6** and Tailwind CSS
* **Dashboard Folder:** `frontend/` (source code under `frontend/src/`)
* *(Note: An initial standalone research prototype was implemented using Plotly Dash in `forecasting dashboard/`).*

### 2.2 Shared Web Dashboard vs. Component Pages
There is **one shared web dashboard** containing pages for all research components, unified under a common routing structure in `frontend/src/App.js`.

* **Forecasting Pages and Components (Your Individual Work):**
  * `frontend/src/pages/ForecastPage.js` & `ForecastPage.css` (`/forecast` route — Leaflet interactive map with color-coded risk status, 8-category breakdown, baseline threshold comparisons).
  * `frontend/src/pages/WasteUpdatePage.js` & `WasteUpdatePage.css` (`/waste-update` route — Waste collection entry form, vehicle number validation, entry tables, live retrain threshold meter, manual retraining trigger).
  * `frontend/src/components/DashboardInsights.js` & `DashboardInsights.css` (Seasonal insights card view displaying peak December collections and dominant waste category shares).
* **Other Members' Pages (Shared / Other Components):**
  * **Bin Fill-Level:** `HomePage.js` (`/bin-level-detector`), `BinStatusPage.js` (`/bins`), `BinDetailPage.js` (`/bins/:id`).
  * **Animal Detection:** `AnimalDetectionPage.js` (`/animals`), `SpeakerCheckPage.js` (`/speaker`).
  * **Litter Severity:** `LitterSeverityPage.js` (`/litter-severity`).
  * **Hygienic Risk:** `HygienicRiskDashboardPage.js` (`/hygienic-risk`).
  * **Operations & Management:** `SystemDashboardPage.js` (`/dashboard`), `LiveMonitoringPage.js` (`/live-monitoring`), `MapPage.js` (`/map`), `AlertsNotificationsPage.js` (`/alerts`), `ReportsPage.js` (`/reports`), `HistoryPage.js` (`/history`), `AdminPage.js` (`/admin`), `MobileReportPage.js` (`/mobile-report`).

### 2.3 Shared UI Elements
* **Dashboard Layout Shell:** `frontend/src/components/dashboard/DashboardLayout.js`
* **Navigation Bar & Sidebar:** `frontend/src/components/dashboard/Sidebar.js`, `frontend/src/components/dashboard/TopBar.js`, and legacy `frontend/src/components/NavBar.js`.
* **Theme & Global Styles:** `frontend/src/index.css`, `frontend/src/App.css`, `frontend/tailwind.config.js`.
* **Authentication Pages:** `frontend/src/pages/LoginPage.js`, `frontend/src/pages/RegisterPage.js`, `frontend/src/pages/LandingPage.js`.

---

## 3. Authentication

* **Mechanism:** **JSON Web Token (JWT)** using `jsonwebtoken` with `bcryptjs` password hashing.
* **Implementation Files:**
  * Backend Middleware: `backend/middleware/auth.js` (`requireAuth`, `requireRole`, `assertJwtConfigured`)
  * Backend Routes: `backend/routes/auth.routes.js` (`POST /auth/register`, `POST /auth/login`, `GET /auth/me`)
  * Backend Controller: `backend/controllers/auth.controller.js`
  * Frontend Context: `frontend/src/context/AuthContext.js`
  * Frontend Route Guard: `frontend/src/components/auth/ProtectedRoute.js`
* **Protection of Forecasting Routes and Pages:**
  * **None.** All forecasting backend routes (`/api/waste-data`, `/api/waste-trend`, `/api/waste-insights`, `/api/waste-entries`) are **public and unauthenticated**.
  * On the frontend, neither `/forecast` (`ForecastPage.js`) nor `/waste-update` (`WasteUpdatePage.js`) is guarded by `ProtectedRoute` (routes are mounted directly in `App.js` without requiring an active login session).

---

## 4. Who Wrote What (Git History)

Git log execution: `git log --format="%an" -- <path>` grouped by author:

| Path / Module | Author | Commit Count | Role |
| :--- | :--- | :---: | :--- |
| **Forecasting Python folder (`waste_forecast`)** | adheeshana herath | 5 | Sole author (100% individual contribution) |
| **Forecasting Dashboard prototype (`forecasting dashboard`)** | adheeshana herath | 12 | Sole author (100% individual contribution) |
| **Waste Entry route (`backend/routes/wasteentries.routes.js`)** | adheeshana herath | 1 | Sole author |
| **Waste Entry repository (`backend/repositories/wasteEntries.repository.js`)** | adheeshana herath | 1 | Sole author |
| **Waste Forecast routes (`wastedata.routes.js`, `wastetrend.routes.js`, `wasteinsights.routes.js`)** | adheeshana herath | 5 | Sole author |
| **Forecast Page (`frontend/src/pages/ForecastPage.js`)** | adheeshana herath<br>IT22200006 | 4<br>2 | Primary author<br>Shared routing/styling integration |
| **Waste Update Page (`frontend/src/pages/WasteUpdatePage.js`)** | adheeshana herath | 1 | Sole author |
| **Dashboard Insights (`frontend/src/components/DashboardInsights.js`)** | adheeshana herath<br>IT22200006 | 4<br>1 | Primary author<br>Minor formatting |
| **Backend Server Setup (`backend/server.js`, `backend/app.js`)** | IT22200006 | 5 | Shared / Teammate infrastructure |
| **Backend Routes Index (`backend/routes/index.js`)** | IT22200006<br>adheeshana herath | 4<br>3 | Gateway setup<br>Mounted forecasting routes |
| **Database Setup (`backend/config/db.js`, `backend/models`)** | IT22200006<br>adheeshana herath | 2<br>1 | Sequelize setup<br>Dialect/config adjustments |
| **Authentication Code (`backend/middleware/auth.js`, `auth.routes.js`, `AuthContext.js`, `LoginPage.js`)** | imashi2001<br>IT22200006 | 4<br>5 | Shared / Teammate feature (0 commits by adheeshana herath) |
| **Shared Dashboard Shell (`frontend/src/components/dashboard`, `NavBar.js`)** | imashi2001<br>IT22200006 | 7<br>4 | Shared / Teammate shell |
| **Frontend App Routing (`frontend/src/App.js`)** | imashi2001<br>IT22200006<br>adheeshana herath | 14<br>10<br>2 | Shell & component routes<br>Shell & component routes<br>Mounted `/forecast` & `/waste-update` |

---

## 5. Output Summary Table

| Work item | My individual contribution | Shared or other members' work |
| :--- | :--- | :--- |
| **Data entry and retraining** | - Created `backend/routes/wasteentries.routes.js` for CRUD operations on waste collection entries.<br>- Created `backend/repositories/wasteEntries.repository.js` and JSON storage at `backend/data/waste_entries.json`.<br>- Built validation-gated continuous retraining pipeline in `waste_forecast/src/retrain_pipeline.py` (triggers on 30 unprocessed records, evaluates candidate RMSE vs live threshold, and updates `waste_forecast/models/model_registry.json`).<br>- Built frontend data entry and retraining monitor UI in `frontend/src/pages/WasteUpdatePage.js` and `WasteUpdatePage.css`. | NOT FOUND *(The waste data entry, JSON storage layer, validation gate, and retraining pipeline were authored and integrated 100% individually by adheeshana herath).* |
| **Forecasting dashboard** | - Developed core ML models and feature engineering in `waste_forecast/` (XGBoost model, walk-forward autoregressive forecasting, calendar features, day profile disaggregation, event multipliers).<br>- Developed backend forecast API routes: `wastedata.routes.js`, `wastetrend.routes.js`, and `wasteinsights.routes.js`.<br>- Developed main forecast frontend dashboard in `frontend/src/pages/ForecastPage.js` and `ForecastPage.css` (interactive map with baseline Q1/Median/Q3/P90 status, category breakdown).<br>- Created seasonal insights component in `frontend/src/components/DashboardInsights.js`.<br>- Developed initial Python Dash analytics prototype in `forecasting dashboard/`. | - Shared dashboard layout shell (`frontend/src/components/dashboard/DashboardLayout.js` by imashi2001 & IT22200006).<br>- Shared navigation sidebar and topbar (`Sidebar.js` and `TopBar.js` by imashi2001 & IT22200006).<br>- Main application routing container (`frontend/src/App.js` primarily maintained by imashi2001 & IT22200006).<br>- Minor layout/styling integration commits on `ForecastPage.js` (2 commits) and `DashboardInsights.js` (1 commit) by IT22200006.<br>- Global theme tokens and base stylesheet (`index.css`, `App.css`, `tailwind.config.js`). |
