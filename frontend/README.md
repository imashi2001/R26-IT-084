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

- **Build command:** `npm run build`
- **Start command:** `npm run serve`
- **Output directory:** `dist`
- **Variable:** `VITE_API_URL=https://your-backend.up.railway.app`
