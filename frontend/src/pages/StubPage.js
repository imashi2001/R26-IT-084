import { Link } from "react-router-dom";
import { Construction, ArrowRight } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";

/*
 * Reusable placeholder for sidebar items that don't have a dedicated UI yet.
 *
 * The point is: every sidebar link must resolve to a real page (no 404s).
 * Each placeholder explains what the page WILL show and points to the closest
 * existing surface so the demo never feels broken. A teammate or future PR can
 * replace any one of these with a full implementation without touching App.js.
 *
 * Usage in App.js:
 *   <Route path="/animals" element={
 *     <StubPage
 *       title="Animal Detection"
 *       description="Filtered captures where YOLO found an animal."
 *       suggestionTo="/hygienic-risk"
 *       suggestionLabel="See animals on the Risk Dashboard for now"
 *     />
 *   } />
 */

export default function StubPage({
  title,
  description,
  suggestionTo,
  suggestionLabel,
}) {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-10 text-center shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Construction className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-ink-900">{title}</h1>
        <p className="mt-2 text-sm text-ink-500">{description}</p>

        {suggestionTo ? (
          <Link
            to={suggestionTo}
            className="mt-5 inline-flex items-center gap-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            {suggestionLabel || "Go there"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}

        <p className="mt-6 text-xs text-ink-400">
          This page is a sidebar placeholder. Implementing it doesn&apos;t
          require touching <code>App.js</code>.
        </p>
      </div>
    </DashboardLayout>
  );
}
