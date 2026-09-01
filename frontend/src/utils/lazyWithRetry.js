import { lazy } from "react";

/**
 * Retry dynamic imports once, then reload on chunk mismatch (common after Railway deploy).
 */
export function lazyWithRetry(importFn) {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (err) {
      const msg = String(err?.message || err);
      const isChunkError =
        /Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError|Unexpected token '<'/i.test(
          msg
        );

      if (isChunkError) {
        try {
          const reloaded = sessionStorage.getItem("vw_chunk_reload");
          if (!reloaded) {
            sessionStorage.setItem("vw_chunk_reload", "1");
            window.location.reload();
            return new Promise(() => {});
          }
          sessionStorage.removeItem("vw_chunk_reload");
        } catch {
          window.location.reload();
          return new Promise(() => {});
        }
      }

      throw err;
    }
  });
}
