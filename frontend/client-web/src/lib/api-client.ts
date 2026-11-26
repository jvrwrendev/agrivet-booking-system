import type { ApiEnvelope } from "@/types/api";

/**
 * The dev server proxies `/api` to the backend (see `vite.config.ts`), so
 * requests are same-origin and the httpOnly session cookie rides along
 * automatically. The env override exists for setups that skip the proxy.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

/** `api/src/config/env.ts` — `PUBLIC_PATHS` are the only unauthenticated routes. */
const PUBLIC_PATHS = new Set(["/auth/login", "/auth/logout", "/auth/status"]);

/**
 * Fallback credential channel.
 *
 * The primary credential is the httpOnly `agrivet_token` cookie, which `fetch`
 * sends automatically with `credentials: "include"`. When a browser blocks or
 * drops that cookie, we also keep the signed token returned at login and attach
 * it as `Authorization: Bearer`. The backend validates both paths identically.
 * sessionStorage survives refresh but is cleared when the tab is closed.
 */
const TOKEN_KEY = "agrivet_access_token";
let bearerToken: string | null = null;

try {
  bearerToken = sessionStorage.getItem(TOKEN_KEY);
} catch {
  bearerToken = null;
}

export function setBearerToken(token: string | null): void {
  bearerToken = token && token.length > 0 ? token : null;
  try {
    if (bearerToken) sessionStorage.setItem(TOKEN_KEY, bearerToken);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — in-memory token still works for this page */
  }
}

export function getBearerToken(): string | null {
  return bearerToken;
}

/** In-flight request controllers, so logout can cancel pending data fetches. */
const activeControllers = new Set<AbortController>();

export function abortAllRequests(): void {
  for (const controller of activeControllers) controller.abort();
  activeControllers.clear();
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** Duplicate email, or a rule such as "cannot delete the last super admin". */
  get isConflict(): boolean {
    return this.status === 409;
  }
}

type UnauthorizedHandler = () => void;

const unauthorizedHandlers = new Set<UnauthorizedHandler>();

/**
 * Default-deny session gate.
 *
 * Starts as `true`: until the cold-load restore or an explicit login proves a
 * session is valid, protected requests fail fast locally instead of hitting
 * the network without credentials (which is what produces a 401 flood in the
 * browser console). It is cleared by `resetSessionState()` only after auth has
 * been established, and re-set on any 401.
 */
let sessionInvalid = true;
let resolveSessionCheck: (() => void) | null = null;
let sessionCheckPromise: Promise<void> | null = null;

/**
 * Gates protected requests while the initial session restore is in flight.
 * This prevents a burst of parallel 401s on cold load when there is no session.
 */
export function beginSessionCheck(): void {
  if (sessionCheckPromise) return;
  sessionCheckPromise = new Promise<void>((resolve) => {
    resolveSessionCheck = resolve;
  });
}

export function finishSessionCheck(): void {
  resolveSessionCheck?.();
  resolveSessionCheck = null;
  sessionCheckPromise = null;
}

export function resetSessionCheck(): void {
  finishSessionCheck();
  beginSessionCheck();
}

/** Called after a successful sign-in so requests start flowing again. */
export function resetSessionState(): void {
  sessionInvalid = false;
}

/** Marks the session as invalid without hitting the network (e.g. no session hint on boot). */
export function markSessionInvalid(): void {
  sessionInvalid = true;
}

export function isSessionInvalid(): boolean {
  return sessionInvalid;
}

export async function waitForSessionCheck(): Promise<void> {
  if (sessionCheckPromise) await sessionCheckPromise;
}

export function notifyUnauthorized(): void {
  if (!sessionInvalid) {
    sessionInvalid = true;
    unauthorizedHandlers.forEach((handler) => handler());
  }
}

/**
 * Registers a callback invoked whenever a request comes back 401.
 *
 * `useAuth` subscribes to this so an expired or revoked session tears down
 * client state. A subscriber set (rather than an import of the auth hook)
 * keeps `api-client` free of React dependencies and avoids a cycle.
 */
export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  unauthorizedHandlers.add(handler);
  return () => {
    unauthorizedHandlers.delete(handler);
  };
}

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof (value as { success: unknown }).success === "boolean"
  );
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "" && value !== "all") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ""}`;
}

export async function request<T>(
  path: string,
  { method = "GET", body, signal, query }: RequestOptions = {}
): Promise<T> {
  const isPublic = PUBLIC_PATHS.has(path);
  // Auth probes must always be able to run, even while the gate is closed.
  const isAuthProbe = path === "/auth/me" || path === "/auth/status";

  // Short-circuit once the session is known to be dead. Every one of these
  // would otherwise be dispatched, answered with 401, and logged by the
  // browser — the redirect to /login is what actually resolves it.
  if (sessionInvalid && !isPublic && !isAuthProbe) {
    throw new ApiError(
      401,
      "SESSION_EXPIRED",
      "Your session has expired. Please sign in again."
    );
  }

  // Wait for the initial /auth/me session restore so protected requests don't
  // flood the network with 401s on a cold unauthenticated load.
  if (sessionCheckPromise && !isPublic && !isAuthProbe) {
    await sessionCheckPromise;
    // Re-check after await in case the session died while waiting.
    if (sessionInvalid && !isPublic && !isAuthProbe) {
      throw new ApiError(
        401,
        "SESSION_EXPIRED",
        "Your session has expired. Please sign in again."
      );
    }
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (bearerToken) headers["Authorization"] = `Bearer ${bearerToken}`;

  const controller = new AbortController();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  activeControllers.add(controller);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: "include",
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Could not reach the server. Check that the API is running."
    );
  } finally {
    activeControllers.delete(controller);
  }

  // A 401 on a public route (e.g. a failed login) is an expected answer, not
  // a session teardown. For protected routes, notify subscribers once and stop
  // accepting further calls until a new session is established.
  if (response.status === 401 && !isPublic) {
    // Both credentials are rejected together — clear the fallback so we never
    // retry with a dead token. The handlers tear down client auth state once.
    setBearerToken(null);
    if (!sessionInvalid) {
      sessionInvalid = true;
      unauthorizedHandlers.forEach((handler) => handler());
    }
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      "INVALID_RESPONSE",
      `Server returned an unreadable response (HTTP ${response.status}).`
    );
  }

  if (!isEnvelope(payload)) {
    throw new ApiError(
      response.status,
      "INVALID_RESPONSE",
      "Server returned an unexpected response shape."
    );
  }

  if (!payload.success) {
    throw new ApiError(
      response.status,
      payload.error.code,
      payload.error.message,
      payload.error.details
    );
  }

  return payload.data as T;
}
