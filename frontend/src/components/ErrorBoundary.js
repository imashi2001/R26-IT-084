import { Component } from "react";
import { RefreshCw } from "lucide-react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isChunkError =
      /Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError/i.test(
        String(error?.message || error)
      );

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b131e] px-6 text-center text-slate-300">
        <p className="text-lg font-semibold text-white">
          {isChunkError ? "Dashboard update available" : "Something went wrong"}
        </p>
        <p className="max-w-md text-sm text-slate-400">
          {isChunkError
            ? "The app was updated. Please refresh the page to load the latest dashboard."
            : error?.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh page
        </button>
      </div>
    );
  }
}
