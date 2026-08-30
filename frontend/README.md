# frontend (React, Vite)

Single-page dashboard for the **Vision-Based Hygienic Risk Prediction and
Animal Deterrence System**. Built with **Vite + React**.

## Folder structure

```
frontend/
├── index.html              Vite entry HTML (loads /src/index.js)
├── vite.config.js          dev server + API proxy to Express
├── package.json            Vite + axios + leaflet + react-router
├── public/                 static assets (optional)
├── src/
│   ├── index.js            entry (ReactDOM.createRoot)
│   ├── index.css           global styles + Tailwind
│   ├── App.js              routes and layout
│   ├── App.css             global dashboard styles
│   ├── components/         reusable UI pieces
│   ├── context/            AuthContext
│   ├── pages/              dashboard and feature pages
│   └── utils/
│       └── apiBase.js      backend URL helpers + axios fetchers
└── README.md
```

## Design system

All authenticated pages use the dark **DashboardLayout** shell (`#0b131e` background,
sidebar + topbar). Shared UI tokens live in:

- `src/components/dashboard/dashboardTheme.js` — layout grids, chart colors, map tiles
- `src/components/dashboard/dashboardUi.js` — inputs, buttons, badges, banners
- `src/components/dashboard/Card.js`, `PageShell.js`, `PageHeader.js`, `FilterBar.js`, `ListRow.js`

Public pages (`/`, `/login`, `/register`) keep a lighter citizen-facing theme.

> **Note:** The legacy `web/` folder at repo root is deprecated. Deploy and develop
> only in **`frontend/`** — it is the canonical React app for Railway.

## Run

```powershell
cd frontend
npm install
npm run dev        # Vite dev server on http://localhost:3000
# or: npm start
```

During development, `vite.config.js` proxies API paths (`/predict`, `/devices`,
`/forecast`, etc.) to `http://localhost:5000` when `VITE_API_URL` is unset.

For production builds set `VITE_API_URL` to the deployed backend URL —
`src/utils/apiBase.js` resolves it automatically.

Copy [`.env.example`](.env.example) to `.env.local` for local overrides
(`VITE_API_URL`, `VITE_ESP32_CAPTURE_URL`, `VITE_LIVE_DEVICE_ID`).

## Build

```powershell
npm run build      # static bundle in dist/
npm run preview    # preview production build locally
npm run serve      # serve dist/ with SPA fallback (Railway start command)
```

## Railway

- **Root directory:** `frontend`
- **Build command:** `npm run build` (auto via Nixpacks)
- **Start command:** `npm start` (serves `dist/` on `$PORT`)
- **Variable:** `VITE_API_URL=https://your-backend.up.railway.app`

Rename any old `REACT_APP_API_URL` to **`VITE_API_URL`** — Vite only reads `VITE_*` at build time.
Redeploy after changing env vars so the bundle is rebuilt.
