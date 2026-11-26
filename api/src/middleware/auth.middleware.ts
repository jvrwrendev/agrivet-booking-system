import type { Request, RequestHandler } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { AppError, Errors } from "../lib/app-error.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { PUBLIC_USER_SELECT, toPublicUser } from "../lib/user-select.js";
import { AUTH_COOKIE_NAME } from "../constants.js";
import type {
  AuthenticatedRequest,
  AuthUser,
  SessionMeta,
} from "../modules/auth/auth.types.js";

/**
 * Credentials are accepted from either the httpOnly session cookie (primary)
 * or an `Authorization: Bearer` header (fallback for clients where the cookie
 * cannot be stored/sent, e.g. blocked third-party cookies). Both paths carry
 * the exact same signed JWT and go through identical session validation below.
 */
export function extractAccessToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }

  const header = req.headers.authorization;
  if (typeof header === "string" && /^Bearer\s+/i.test(header)) {
    const bearer = header.replace(/^Bearer\s+/i, "").trim();
    if (bearer.length > 0) return bearer;
  }

  return undefined;
}

export const authenticate: RequestHandler = asyncHandler(
  async (req, _res, next) => {
    const token = extractAccessToken(req);

    if (!token) {
      throw Errors.unauthorized("Not authenticated");
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw Errors.unauthorized("Session is invalid or has expired");
    }

    if (typeof payload.sid !== "string" || payload.sid.length === 0) {
      throw Errors.unauthorized("Session is invalid or has expired");
    }

    const session = await prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: { select: PUBLIC_USER_SELECT } },
    });

    if (!session) {
      throw Errors.unauthorized("Session no longer exists");
    }

    if (session.revokedAt) {
      throw Errors.unauthorized("Session has been revoked");
    }

    if (session.expiresAt <= new Date()) {
      await prisma.session
        .delete({ where: { id: session.id } })
        .catch(() => undefined);
      throw Errors.unauthorized("Session has expired");
    }

    const user = toPublicUser(session.user);

    if (user.status !== "ACTIVE") {
      throw Errors.unauthorized("Account is inactive or suspended");
    }

    if (!user.emailVerified) {
      throw new AppError(403, "Please verify your email address before continuing.", {
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    const authReq = req as AuthenticatedRequest;
    authReq.user = user as AuthUser;
    authReq.session = {
      id: session.id,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    } satisfies SessionMeta;
    next();
  },
);

const PUBLIC_PATHS = [
  "/health",
  "/api/v1/auth/status",
  "/api/v1/auth/register",
  "/api/v1/auth/login",
  "/api/v1/auth/logout",
  "/api/v1/auth/verify-email",
  "/api/v1/auth/verify-email/resend",
] as const;

export function unless(
  paths: readonly string[],
  handler: RequestHandler,
): RequestHandler {
  const publicSet = new Set(paths);
  return (req, res, next) => {
    const normalized = req.path.replace(/\/+$/, "");
    if (publicSet.has(normalized)) {
      next();
      return;
    }
    handler(req, res, next);
  };
}

export const authenticateUnlessPublic = unless(
  PUBLIC_PATHS,
  authenticate,
);