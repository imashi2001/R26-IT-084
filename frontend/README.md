# frontend (React, CRA)

Single-page dashboard for the **Vision-Based Hygienic Risk Prediction and
Animal Deterrence System**. Built on **Create React App** (`react-scripts`)
to mirror the `test` branch's layout so a future merge stays clean.

## Folder structure

```
frontend/
├── package.json            CRA + axios + leaflet + react-router
├── public/
│   └── index.html          CRA template (no <script> tag - injected at build)
├── src/
│   ├── index.js            entry (ReactDOM.createRoot)
│   ├── index.css           global styles
│   ├── App.js              the main dashboard (single page, inline styles)
│   ├── App.css             stub (App.js uses inline styles)
│   ├── components/         reusable UI pieces
│   ├── context/            placeholder for AuthContext etc.
│   ├── pages/              placeholder for multi-page router
│   └── utils/
│       └── apiBase.js      backend URL helpers + axios fetchers
└── README.md
```

## Run

```powershell
cd frontend
npm install
npm start          # CRA dev server on http://localhost:3000
```

CRA's `package.json` proxy is set to `http://localhost:5000` so any unmatched
request (e.g. `/predict`, `/forecast`) is forwarded to the Express backend
during development. For production builds set `REACT_APP_API_URL` to the
deployed backend URL — `src/utils/apiBase.js` resolves it automatically.

## Build

```powershell
npm run build      # static bundle in build/
```
