-- CreateEnum
CREATE TYPE "AgentTrackingStatus" AS ENUM ('ONLINE', 'INACTIVE', 'OFFLINE', 'GPS_UNAVAILABLE');

-- CreateTable
CREATE TABLE "agent_locations" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "accuracy" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "locationLabel" TEXT,
    "trackingStatus" "AgentTrackingStatus" NOT NULL DEFAULT 'OFFLINE',
    "isTracking" BOOLEAN NOT NULL DEFAULT false,
    "gpsAvailable" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_location_history" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "currentId" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "locationLabel" TEXT,
    "status" "AgentTrackingStatus" NOT NULL DEFAULT 'ONLINE',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_location_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_locations_agentId_key" ON "agent_locations"("agentId");

-- CreateIndex
CREATE INDEX "agent_locations_trackingStatus_lastSeenAt_idx" ON "agent_locations"("trackingStatus", "lastSeenAt");

-- CreateIndex
CREATE INDEX "agent_location_history_agentId_recordedAt_idx" ON "agent_location_history"("agentId", "recordedAt");

-- CreateIndex
CREATE INDEX "agent_location_history_recordedAt_idx" ON "agent_location_history"("recordedAt");

-- AddForeignKey
ALTER TABLE "agent_locations" ADD CONSTRAINT "agent_locations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_location_history" ADD CONSTRAINT "agent_location_history_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_location_history" ADD CONSTRAINT "agent_location_history_currentId_fkey" FOREIGN KEY ("currentId") REFERENCES "agent_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
