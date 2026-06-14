// ---------------------------------------------------------------------------
// Base API client — wraps fetch with base URL, headers, error handling
// ---------------------------------------------------------------------------

// In production, VITE_API_BASE_URL must be set to the deployed backend URL (e.g. https://campaign-copilot-api.onrender.com).
// In local development it falls back to http://127.0.0.1:8000 so nothing breaks.
const _rawBase = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const API_BASE = _rawBase.replace(/\/$/, "") + "/api";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    let code = "API_ERROR";
    let message = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
      }
    } catch {
      // ignore JSON parse failure
    }
    throw new ApiClientError(res.status, code, message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | undefined>) => {
    const url = params
      ? `${path}?${new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        ).toString()}`
      : path;
    return request<T>(url);
  },

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),

  delete: (path: string) => request<void>(path, { method: "DELETE" }),
};
