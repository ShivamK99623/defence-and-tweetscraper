import { API_BASE_URL, AUTH_DISABLED } from "@/config/env";
import {
  ApiError,
  messageFromErrorBody,
} from "@/lib/api/errors";

const DEFAULT_TIMEOUT_MS = 30_000;

export type QueryParams = Record<
  string,
  string | number | boolean | Array<string | number> | undefined | null
>;

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
  query?: QueryParams;
  signal?: AbortSignal;
  /** Request timeout in ms. Defaults to 30s. Set 0 to disable. */
  timeoutMs?: number;
  /** When true, skip JSON parse and return the raw Response. */
  raw?: boolean;
}

function buildUrl(path: string, query?: QueryParams): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalized}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item));
        }
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function mergeSignals(
  external: AbortSignal | undefined,
  timeoutSignal: AbortSignal | undefined
): AbortSignal | undefined {
  if (!external && !timeoutSignal) return undefined;
  if (!external) return timeoutSignal;
  if (!timeoutSignal) return external;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([external, timeoutSignal]);
  }
  return timeoutSignal;
}

async function parseError(response: Response): Promise<ApiError> {
  const fallback =
    response.statusText || `Request failed with status ${response.status}`;
  let details: unknown = null;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      details = await response.json();
    } catch {
      details = null;
    }
  } else {
    try {
      const text = await response.text();
      details = text || null;
    } catch {
      details = null;
    }
  }

  return new ApiError(
    response.status,
    messageFromErrorBody(details, fallback),
    details
  );
}

function maybeRedirectOnUnauthorized(path: string, status: number): void {
  if (AUTH_DISABLED || status !== 401 || typeof window === "undefined") return;
  if (path.startsWith("/api/auth/login") || path.startsWith("/api/auth/signup")) {
    return;
  }
  const current = window.location.pathname;
  if (current === "/login" || current === "/signup") return;
  const loginUrl = new URL("/login", window.location.origin);
  if (current !== "/") {
    loginUrl.searchParams.set("from", current);
  }
  window.location.assign(loginUrl.toString());
}

async function request<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    method = "GET",
    body,
    headers,
    query,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    raw = false,
  } = options;

  const url = buildUrl(path, query);
  const timeoutController =
    timeoutMs > 0 ? new AbortController() : undefined;
  const timeoutId =
    timeoutController && timeoutMs > 0
      ? setTimeout(() => timeoutController.abort(), timeoutMs)
      : undefined;

  const finalSignal = mergeSignals(signal, timeoutController?.signal);

  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }
  if (body !== undefined && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(url, {
      method,
      credentials: "include",
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: finalSignal,
    });

    if (!response.ok) {
      const error = await parseError(response);
      maybeRedirectOnUnauthorized(path, error.status);
      throw error;
    }

    if (raw) {
      return response as T;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as T;
    }

    return (await response.text()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(408, "Request timed out or was aborted");
    }
    throw new ApiError(
      500,
      error instanceof Error ? error.message : "Network request failed"
    );
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

async function requestBlob(
  path: string,
  options: Omit<ApiRequestOptions, "raw"> = {}
): Promise<Blob> {
  const response = await request<Response>(path, { ...options, raw: true });
  return response.blob();
}

/**
 * Centralized API client. All backend calls should go through this.
 * Paths are absolute from the API root, e.g. `/api/dashboard/overview`.
 */
export const api = {
  get<T>(path: string, options?: Omit<ApiRequestOptions, "method" | "body">) {
    return request<T>(path, { ...options, method: "GET" });
  },

  post<T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">
  ) {
    return request<T>(path, { ...options, method: "POST", body });
  },

  put<T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">
  ) {
    return request<T>(path, { ...options, method: "PUT", body });
  },

  patch<T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">
  ) {
    return request<T>(path, { ...options, method: "PATCH", body });
  },

  delete<T>(path: string, options?: Omit<ApiRequestOptions, "method" | "body">) {
    return request<T>(path, { ...options, method: "DELETE" });
  },

  getBlob(
    path: string,
    options?: Omit<ApiRequestOptions, "method" | "body" | "raw">
  ) {
    return requestBlob(path, { ...options, method: "GET" });
  },

  postBlob(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body" | "raw">
  ) {
    return requestBlob(path, { ...options, method: "POST", body });
  },

  /** Build a fully-qualified API URL (e.g. for rare non-fetch consumers). */
  url(path: string, query?: QueryParams): string {
    return buildUrl(path, query);
  },
};
