import type { AgentTrackingStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/app-error.js";
import { publishAgentLocation } from "../../lib/realtime.js";
import type { AuthUser } from "../auth/auth.types.js";
import type {
  AgentLocationHistoryQueryDto,
  UpdateAgentLocationDto,
} from "./dto/index.js";

type TrackingStatus = "online" | "inactive" | "offline" | "gps_unavailable";

const ONLINE_THRESHOLD_MS = 45_000;
const INACTIVE_THRESHOLD_MS = 5 * 60_000;

export interface AgentLocationView {
  agentId: string;
  agentName: string;
  avatar: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  locationLabel: string | null;
  status: TrackingStatus;
  isLive: boolean;
  isTracking: boolean;
  gpsAvailable: boolean;
  lastSeenAt: string | null;
  recordedAt: string | null;
  updatedAt: string | null;
}

export interface AgentLocationHistoryPoint {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  locationLabel: string | null;
  status: TrackingStatus;
  recordedAt: string;
}

function toNum(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : Number(value);
}

function mapStatus(
  status: AgentTrackingStatus,
  lastSeenAt: Date | null,
  gpsAvailable: boolean,
  isTracking: boolean,
): TrackingStatus {
  if (!gpsAvailable) return "gps_unavailable";
  if (!isTracking) return "offline";
  if (!lastSeenAt) return status === "GPS_UNAVAILABLE" ? "gps_unavailable" : "offline";
  const age = Date.now() - lastSeenAt.getTime();
  if (age <= ONLINE_THRESHOLD_MS) return "online";
  if (age <= INACTIVE_THRESHOLD_MS) return "inactive";
  return "offline";
}

function toView(row: {
  agentId: string;
  agent: { name: string; avatar: string | null };
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  locationLabel: string | null;
  trackingStatus: AgentTrackingStatus;
  isTracking: boolean;
  gpsAvailable: boolean;
  lastSeenAt: Date | null;
  recordedAt: Date;
  updatedAt: Date;
}): AgentLocationView {
  const status = mapStatus(row.trackingStatus, row.lastSeenAt, row.gpsAvailable, row.isTracking);
  return {
    agentId: row.agentId,
    agentName: row.agent.name,
    avatar: row.agent.avatar,
    latitude: toNum(row.latitude),
    longitude: toNum(row.longitude),
    accuracy: row.accuracy,
    speed: row.speed,
    heading: row.heading,
    locationLabel: row.locationLabel,
    status,
    isLive: status === "online",
    isTracking: row.isTracking,
    gpsAvailable: row.gpsAvailable,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    recordedAt: row.recordedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

const locationInclude = {
  agent: { select: { name: true, avatar: true } },
} as const;

async function ensureAgent(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true },
  });
  if (!user || user.role !== "AGENT" || user.status !== "ACTIVE") {
    throw Errors.forbidden("Only active agents can update location");
  }
  return user;
}

export async function updateMyLocation(user: AuthUser, dto: UpdateAgentLocationDto) {
  await ensureAgent(user.id);

  const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : new Date();
  if (Number.isNaN(recordedAt.getTime())) {
    throw Errors.badRequest("Invalid recordedAt timestamp");
  }
  if (recordedAt.getTime() > Date.now() + 5 * 60_000) {
    throw Errors.badRequest("recordedAt cannot be in the future");
  }

  const existing = await prisma.agentLocation.findUnique({
    where: { agentId: user.id },
    select: { recordedAt: true },
  });

  if (existing && existing.recordedAt > recordedAt) {
    console.info("[agent-location] ignored stale update", {
      agentId: user.id,
      recordedAt: recordedAt.toISOString(),
      currentRecordedAt: existing.recordedAt.toISOString(),
    });
    return getAgentLocationById(user.id);
  }

  const gpsAvailable = dto.gpsAvailable ?? true;
  const isTracking = dto.isTracking ?? true;
  const trackingStatus: AgentTrackingStatus = !gpsAvailable
    ? "GPS_UNAVAILABLE"
    : isTracking
      ? "ONLINE"
      : "OFFLINE";

  const location = await prisma.agentLocation.upsert({
    where: { agentId: user.id },
    create: {
      agentId: user.id,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy ?? null,
      speed: dto.speed ?? null,
      heading: dto.heading ?? null,
      locationLabel: dto.locationLabel ?? null,
      trackingStatus,
      isTracking,
      gpsAvailable,
      lastSeenAt: recordedAt,
      recordedAt,
    },
    update: {
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy ?? null,
      speed: dto.speed ?? null,
      heading: dto.heading ?? null,
      locationLabel: dto.locationLabel ?? null,
      trackingStatus,
      isTracking,
      gpsAvailable,
      lastSeenAt: recordedAt,
      recordedAt,
    },
    include: locationInclude,
  });

  const lastHistory = await prisma.agentLocationHistory.findFirst({
    where: { agentId: user.id },
    orderBy: { recordedAt: "desc" },
    select: { recordedAt: true, latitude: true, longitude: true },
  });

  const sameRecordedAt =
    lastHistory?.recordedAt.getTime() === recordedAt.getTime();
  const sameCoords =
    lastHistory &&
    Number(lastHistory.latitude) === dto.latitude &&
    Number(lastHistory.longitude) === dto.longitude &&
    recordedAt.getTime() - lastHistory.recordedAt.getTime() < 10_000;

  if (!sameRecordedAt && !sameCoords) {
    await prisma.agentLocationHistory.create({
      data: {
        agentId: user.id,
        currentId: location.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy ?? null,
        speed: dto.speed ?? null,
        heading: dto.heading ?? null,
        locationLabel: dto.locationLabel ?? null,
        status: trackingStatus,
        recordedAt,
      },
    });
  }

  const view = toView(location);
  console.info("[agent-location] updated", {
    agentId: user.id,
    status: view.status,
    latitude: view.latitude,
    longitude: view.longitude,
    recordedAt: view.recordedAt,
    historyInserted: !sameRecordedAt && !sameCoords,
  });
  publishAgentLocation(view);
  return view;
}

export async function setAgentTrackingState(
  user: AuthUser,
  state: { isTracking: boolean; gpsAvailable?: boolean },
) {
  await ensureAgent(user.id);
  const existing = await prisma.agentLocation.findUnique({ where: { agentId: user.id } });
  const gpsAvailable = state.gpsAvailable ?? existing?.gpsAvailable ?? true;
  const trackingStatus: AgentTrackingStatus = !gpsAvailable
    ? "GPS_UNAVAILABLE"
    : state.isTracking
      ? "ONLINE"
      : "OFFLINE";

  const location = await prisma.agentLocation.upsert({
    where: { agentId: user.id },
    create: {
      agentId: user.id,
      trackingStatus,
      isTracking: state.isTracking,
      gpsAvailable,
      lastSeenAt: existing?.lastSeenAt ?? null,
      recordedAt: existing?.recordedAt ?? new Date(),
    },
    update: {
      trackingStatus,
      isTracking: state.isTracking,
      gpsAvailable,
    },
    include: locationInclude,
  });
  const view = toView(location);
  publishAgentLocation(view);
  return view;
}

export async function listAgentLocations(): Promise<AgentLocationView[]> {
  const agents = await prisma.user.findMany({
    where: { role: "AGENT", status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      avatar: true,
      agentLocation: { include: locationInclude },
    },
    orderBy: { name: "asc" },
  });

  return agents.map((agent) => {
    if (agent.agentLocation) return toView(agent.agentLocation);
    return {
      agentId: agent.id,
      agentName: agent.name,
      avatar: agent.avatar,
      latitude: null,
      longitude: null,
      accuracy: null,
      speed: null,
      heading: null,
      locationLabel: null,
      status: "offline" as TrackingStatus,
      isLive: false,
      isTracking: false,
      gpsAvailable: true,
      lastSeenAt: null,
      recordedAt: null,
      updatedAt: null,
    };
  });
}

export async function getAgentLocationById(agentId: string): Promise<AgentLocationView> {
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      name: true,
      avatar: true,
      role: true,
      agentLocation: { include: locationInclude },
    },
  });
  if (!agent || agent.role !== "AGENT") {
    throw Errors.notFound("Agent not found");
  }
  if (agent.agentLocation) return toView(agent.agentLocation);
  return {
    agentId: agent.id,
    agentName: agent.name,
    avatar: agent.avatar,
    latitude: null,
    longitude: null,
    accuracy: null,
    speed: null,
    heading: null,
    locationLabel: null,
    status: "offline",
    isLive: false,
    isTracking: false,
    gpsAvailable: true,
    lastSeenAt: null,
    recordedAt: null,
    updatedAt: null,
  };
}

export async function getAgentLocationHistory(
  agentId: string,
  query: AgentLocationHistoryQueryDto,
): Promise<AgentLocationHistoryPoint[]> {
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { id: true, role: true },
  });
  if (!agent || agent.role !== "AGENT") throw Errors.notFound("Agent not found");

  const where: Prisma.AgentLocationHistoryWhereInput = { agentId };
  if (query.from || query.to) {
    where.recordedAt = {};
    if (query.from) where.recordedAt.gte = new Date(query.from);
    if (query.to) where.recordedAt.lte = new Date(query.to);
  }

  const rows = await prisma.agentLocationHistory.findMany({
    where,
    orderBy: { recordedAt: "desc" },
    take: query.limit,
  });

  return rows.map((row) => ({
    id: row.id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracy: row.accuracy,
    speed: row.speed,
    heading: row.heading,
    locationLabel: row.locationLabel,
    status: mapStatus(row.status, row.recordedAt, row.status !== "GPS_UNAVAILABLE", row.status !== "OFFLINE"),
    recordedAt: row.recordedAt.toISOString(),
  })).reverse();
}
