import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import HygienicRiskDashboardPage from "./pages/HygienicRiskDashboardPage";

/**
 * Thin router shell — keeps merge friction low when joining `test`:
 *
 * 1. Bring in HomePage from test: `import HomePage from "./pages/HomePage";`
 * 2. Replace the `/` route with `<Route path="/" element={<HomePage />} />`
 * 3. From HomePage, navigate to this screen with:
 *    `<Link to="/hygienic-risk">…</Link>` or `useNavigate()` to `/hygienic-risk`
 *
 * Do not move dashboard logic back into this file; edit `pages/HygienicRiskDashboardPage.js`.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/hygienic-risk" element={<HygienicRiskDashboardPage />} />
        {/* Until HomePage exists here: same landing behavior as before merge */}
        <Route path="/" element={<Navigate to="/hygienic-risk" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
