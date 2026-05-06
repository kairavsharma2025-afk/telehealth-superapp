import { tokenStore } from "./tokenStore";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (code !== undefined) this.code = code;
    this.details = details;
  }
}

const API_BASE = "/api";

interface FetchOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

let refreshInFlight: Promise<boolean> | null = null;

export async function api<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  return doFetch<T>(path, opts, /*allowRefresh*/ true);
}

async function doFetch<T>(
  path: string,
  opts: FetchOptions,
  allowRefresh: boolean,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const access = tokenStore.getAccessToken();
  if (access) headers["Authorization"] = `Bearer ${access}`;

  const init: RequestInit = { method: opts.method ?? "GET", headers };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  if (opts.signal) init.signal = opts.signal;

  const res = await fetch(`${API_BASE}${path}`, init);

  if (res.status === 401 && allowRefresh && tokenStore.getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) return doFetch<T>(path, opts, /*allowRefresh*/ false);
    tokenStore.clear();
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const parsed: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    const errInfo = extractError(parsed);
    throw new ApiError(res.status, errInfo.message, errInfo.code, errInfo.details);
  }
  return parsed as T;
}

async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refreshToken = tokenStore.getRefreshToken();
      if (!refreshToken) return false;
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as { accessToken?: unknown };
      if (typeof json.accessToken !== "string") return false;
      tokenStore.setSession({ accessToken: json.accessToken });
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractError(parsed: unknown): { message: string; code?: string; details?: unknown } {
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "error" in parsed &&
    typeof (parsed as { error: unknown }).error === "object"
  ) {
    const err = (parsed as { error: Record<string, unknown> }).error;
    const message = typeof err["message"] === "string" ? err["message"] : "Request failed";
    const code = typeof err["code"] === "string" ? err["code"] : undefined;
    return code !== undefined
      ? { message, code, details: err["details"] }
      : { message, details: err["details"] };
  }
  return { message: "Request failed" };
}
