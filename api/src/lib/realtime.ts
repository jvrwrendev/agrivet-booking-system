import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { AUTH_COOKIE_NAME } from "../constants.js";
import { env } from "../config/env.js";
import { verifyAccessToken } from "./jwt.js";
import { prisma } from "./prisma.js";

type AgentLocationPayload = {
  agentId: string;
  agentName: string;
  avatar: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  locationLabel: string | null;
  status: "online" | "inactive" | "offline" | "gps_unavailable";
  isLive: boolean;
  isTracking: boolean;
  gpsAvailable: boolean;
  lastSeenAt: string | null;
  recordedAt: string | null;
  updatedAt: string | null;
};

let io: Server | null = null;

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        if (idx === -1) return [part, ""];
        return [decodeURIComponent(part.slice(0, idx)), decodeURIComponent(part.slice(idx + 1))];
      }),
  );
}

export function initRealtime(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (env.corsOrigins.includes(origin)) return callback(null, true);
        if (!env.isProduction) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const token = cookies[AUTH_COOKIE_NAME];
      if (!token) return next(new Error("Unauthorized"));
      const payload = verifyAccessToken(token);
      if (typeof payload.sid !== "string") return next(new Error("Unauthorized"));
      const session = await prisma.session.findUnique({
        where: { id: payload.sid },
        include: { user: { select: { id: true, role: true, status: true, emailVerified: true } } },
      });
      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        return next(new Error("Unauthorized"));
      }
      if (session.user.status !== "ACTIVE" || !session.user.emailVerified) {
        return next(new Error("Unauthorized"));
      }
      socket.data.user = { id: session.user.id, role: session.user.role };
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as { id: string; role: string } | undefined;
    if (!user) {
      socket.disconnect(true);
      return;
    }
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      socket.join("admins:locations");
    }
    if (user.role === "AGENT") {
      socket.join(`agent:${user.id}`);
    }
  });

  return io;
}

export function publishAgentLocation(location: AgentLocationPayload) {
  if (!io) return;
  io.to("admins:locations").emit("agent:location:update", { location });
  io.to(`agent:${location.agentId}`).emit("agent:location:update", { location });
}

export function getRealtime() {
  return io;
}
