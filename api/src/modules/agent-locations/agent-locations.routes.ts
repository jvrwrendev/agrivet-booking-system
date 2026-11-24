import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireRole } from "../../middleware/role.middleware.js";
import {
  getAgentLocationController,
  getAgentLocationHistoryController,
  listAgentLocationsController,
  updateMyLocationController,
  updateMyTrackingStateController,
} from "./agent-locations.controller.js";

export const agentLocationsRouter = Router();

const locationUpdateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many location updates. Please wait before retrying.",
    },
  },
});

agentLocationsRouter.post(
  "/location",
  requireRole("AGENT"),
  locationUpdateLimiter,
  updateMyLocationController,
);

agentLocationsRouter.post(
  "/location/state",
  requireRole("AGENT"),
  updateMyTrackingStateController,
);

agentLocationsRouter.get(
  "/locations",
  requireRole("ADMIN", "SUPER_ADMIN"),
  listAgentLocationsController,
);

agentLocationsRouter.get(
  "/:id/location/history",
  requireRole("ADMIN", "SUPER_ADMIN"),
  getAgentLocationHistoryController,
);

agentLocationsRouter.get(
  "/:id/location",
  requireRole("ADMIN", "SUPER_ADMIN"),
  getAgentLocationController,
);
