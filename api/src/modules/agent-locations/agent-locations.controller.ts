import { asyncHandler } from "../../lib/async-handler.js";
import { sendSuccess } from "../../lib/api-response.js";
import { Errors } from "../../lib/app-error.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import * as service from "./agent-locations.service.js";
import {
  agentLocationHistoryQueryDto,
  agentLocationParamsDto,
  updateAgentLocationDto,
} from "./dto/index.js";

export const updateMyLocationController = asyncHandler(
  async (req: AuthenticatedRequest, res) => {
    const parsed = updateAgentLocationDto.safeParse(req.body);
    if (!parsed.success) {
      console.warn("[agent-location] invalid payload", {
        agentId: req.user?.id,
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      });
      throw Errors.badRequest("Invalid location payload", parsed.error.flatten());
    }

    const location = await service.updateMyLocation(req.user, parsed.data);
    sendSuccess(res, { location });
  },
);

export const updateMyTrackingStateController = asyncHandler(
  async (req: AuthenticatedRequest, res) => {
    const body = updateAgentLocationDto.pick({ isTracking: true, gpsAvailable: true }).parse(req.body);
    const location = await service.setAgentTrackingState(req.user, {
      isTracking: body.isTracking ?? true,
      gpsAvailable: body.gpsAvailable,
    });
    sendSuccess(res, { location });
  },
);

export const listAgentLocationsController = asyncHandler(async (_req, res) => {
  const locations = await service.listAgentLocations();
  sendSuccess(res, { locations });
});

export const getAgentLocationController = asyncHandler(
  async (req: AuthenticatedRequest<{ id: string }>, res) => {
    const { id } = agentLocationParamsDto.parse(req.params);
    const location = await service.getAgentLocationById(id);
    sendSuccess(res, { location });
  },
);

export const getAgentLocationHistoryController = asyncHandler(
  async (req: AuthenticatedRequest<{ id: string }>, res) => {
    const { id } = agentLocationParamsDto.parse(req.params);
    const query = agentLocationHistoryQueryDto.parse(req.query);
    const history = await service.getAgentLocationHistory(id, query);
    sendSuccess(res, { history });
  },
);
