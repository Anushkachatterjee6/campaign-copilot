// ---------------------------------------------------------------------------
// API base URL resolution — build-time env + SSR/runtime injection
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __API_BASE_URL__?: string;
  }
}

/** Read runtime URL injected by RootShell SSR (Vercel / Nitro process.env.API_BASE_URL). */
function readRuntimeApiBase(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const fromWindow = window.__API_BASE_URL__?.trim();
  if (fromWindow) return fromWindow;
  const meta = document.querySelector('meta[name="api-base-url"]');
  const fromMeta = meta?.getAttribute("content")?.trim();
  return fromMeta || undefined;
}

/**
 * Resolve the backend origin (no trailing slash, no /api suffix).
 * Priority: Vite build env → SSR/runtime meta → local dev fallback.
 */
export function getApiOrigin(): string {
  const fromVite = import.meta.env.VITE_API_BASE_URL?.trim();
  if (fromVite) return fromVite.replace(/\/$/, "");

  const fromRuntime = readRuntimeApiBase();
  if (fromRuntime) return fromRuntime.replace(/\/$/, "");

  // Dev-only fallback — must NOT be used in production builds without env vars.
  if (import.meta.env.DEV) return "http://127.0.0.1:8000";

  // Production with no config: warn once and still attempt relative /api proxy if present.
  if (typeof console !== "undefined") {
    console.warn(
      "[Campaign Copilot] VITE_API_BASE_URL is not set. Set it in Vercel (build) and API_BASE_URL (runtime).",
    );
  }
  return "";
}

/** Full REST prefix, e.g. https://host.hf.space/api */
export function getApiBase(): string {
  const origin = getApiOrigin();
  if (!origin) {
    // Same-origin proxy fallback (e.g. future Nitro rewrite)
    return "/api";
  }
  return `${origin}/api`;
}
