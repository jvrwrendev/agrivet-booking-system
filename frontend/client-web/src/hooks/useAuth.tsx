import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { abortAllRequests, ApiError, beginSessionCheck, finishSessionCheck, markSessionInvalid, onUnauthorized, resetSessionState, setBearerToken } from "@/lib/api-client";
import { getAuthStatus, getCurrentUser, login as loginRequest, logout as logoutRequest } from "@/features/auth/services/auth.service";
import type { AuthUser } from "@/types/auth";
import { toAuthUser } from "@/features/users/lib/user-mapper";

/**
 * Session state for the API's cookie-based auth.
 *
 * The API issues an httpOnly `agrivet_token` cookie and never returns the JWT
 * to JavaScript, so there is nothing to persist in localStorage. On boot we ask
 * `GET /auth/me` who we are; the cookie decides the answer. A 401 anywhere in
 * the app tears down state through the `onUnauthorized` subscription.
 */

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * True when a live session was rejected mid-use (expired or revoked), as
   * opposed to never having signed in. The login page uses it to explain why
   * the user was sent back.
   */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_HINT_KEY = "agrivet_has_session";

function setSessionHint() {
  try { localStorage.setItem(SESSION_HINT_KEY, "1"); } catch { /* ignore */ }
}
function clearSessionHint() {
  try { localStorage.removeItem(SESSION_HINT_KEY); } catch { /* ignore */ }
}
function hasSessionHint() {
  try { return localStorage.getItem(SESSION_HINT_KEY) === "1"; } catch { return true; }
}

/**
 * Single-flight cold-load restore.
 *
 * React StrictMode mounts the provider, tears it down, and mounts it again in
 * development. Without a shared promise this fires `/auth/me` twice and logs a
 * duplicate (expected) 401. One page load gets exactly one restore probe.
 */
let coldRestorePromise: Promise<AuthUser | null> | null = null;

async function performColdRestore(): Promise<AuthUser | null> {
  try {
    // Probe with an always-200 endpoint first. On a cold logged-out load this
    // avoids the browser's network 401 log that /auth/me would otherwise emit.
    const { hasCredentials } = await getAuthStatus();
    if (!hasCredentials) {
      markSessionInvalid();
      return null;
    }
    const { user: dto } = await getCurrentUser();
    // Credentials verified — open the gate for protected requests.
    resetSessionState();
    setSessionHint();
    return toAuthUser(dto);
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized) {
      // No active session (cold load or expired/revoked cookie) — expected.
      clearSessionHint();
      markSessionInvalid();
    } else {
      console.error("Failed to restore session:", error);
    }
    return null;
  }
}

function restoreSessionOnce(): Promise<AuthUser | null> {
  if (!coldRestorePromise) coldRestorePromise = performColdRestore();
  return coldRestorePromise;
}

/** Called after an explicit login so the next reload probes again. */
function resetColdRestore(): void {
  coldRestorePromise = null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Read inside the 401 handler to tell "session died" apart from "never
  // signed in" — the cold-boot `/auth/me` probe also 401s when there is no
  // cookie, and that must not be reported as an expiry.
  const hadUserRef = useRef(false);
  useEffect(() => {
    hadUserRef.current = Boolean(user);
  }, [user]);

  const clearSession = useCallback(() => {
    clearSessionHint();
    setBearerToken(null);
    markSessionInvalid();
    if (hadUserRef.current) setSessionExpired(true);
    setUser(null);
  }, []);

  useEffect(() => onUnauthorized(clearSession), [clearSession]);

  useEffect(() => {
    let cancelled = false;
    beginSessionCheck();

    restoreSessionOnce()
      .then((restored) => {
        if (!cancelled) setUser(restored);
      })
      .finally(() => {
        finishSessionCheck();
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await loginRequest({ email, password });

      // Establish the fallback credential before any protected call fires.
      setBearerToken(result.accessToken ?? null);
      resetSessionState();
      resetColdRestore();
      setSessionHint();

      // Verify a real credential was established. If the browser rejected the
      // cookie AND the token is unusable, fail here instead of leaving the UI
      // in a "logged in" state where every API call returns "Not authenticated".
      try {
        await getCurrentUser();
      } catch {
        setBearerToken(null);
        clearSessionHint();
        markSessionInvalid();
        return {
          success: false,
          error: "Unable to establish a session. Check your browser's cookie/privacy settings and try again.",
        };
      }

      setSessionExpired(false);
      setUser(toAuthUser(result.user));
      return { success: true };
    } catch (error) {
      if (error instanceof ApiError) {
        return { success: false, error: error.message };
      }
      return { success: false, error: "Login failed. Please try again." };
    }
  }, []);

  const logout = useCallback(async () => {
    // Tear down local auth SYNCHRONOUSLY, before the async server call. This is
    // critical: callers navigate to /login immediately after invoking logout,
    // and if `isAuthenticated` is still true the login page redirects straight
    // back, remounting every provider which then fires requests against the
    // session we are about to revoke — producing a burst of 401s.
    markSessionInvalid();
    abortAllRequests();
    setBearerToken(null);
    clearSessionHint();
    setUser(null);
    setSessionExpired(false);

    try {
      await logoutRequest();
    } catch {
      // The local session is already torn down; a failed server revoke must
      // not trap the user in a signed-in shell.
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user: dto } = await getCurrentUser();
      setSessionHint();
      setUser(toAuthUser(dto));
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized) {
        clearSessionHint();
        setBearerToken(null);
        markSessionInvalid();
      }
      setUser(null);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    // Allow recovery attempts after a session hint exists.
    resetSessionState();
    await refreshUser();
  }, [refreshUser]);

  // Visibility/focus recovery: if the user returns to the tab and we have a
  // hint but no user, attempt one recovery.
  useEffect(() => {
    const recover = () => {
      if (hasSessionHint() && !user) {
        void refreshSession();
      }
    };
    document.addEventListener("visibilitychange", recover);
    window.addEventListener("focus", recover);
    return () => {
      document.removeEventListener("visibilitychange", recover);
      window.removeEventListener("focus", recover);
    };
  }, [user, refreshSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      sessionExpired,
      login,
      logout,
      refreshUser,
      refreshSession,
    }),
    [user, isLoading, sessionExpired, login, logout, refreshUser, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}