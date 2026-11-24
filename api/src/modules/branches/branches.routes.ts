import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware/validation.middleware.js";
import {
  createBranchController,
  deleteBranchController,
  getBranchController,
  getMyBranchController,
  listBranchesController,
  updateBranchController,
  updateBranchStatusController,
} from "./branches.controller.js";
import {
  branchParamsDto,
  createBranchDto,
  listBranchesQueryDto,
  updateBranchDto,
  updateBranchStatusDto,
} from "./dto/index.js";

export const branchesRouter = Router();

// Branch account self-service: fetch own branch details for mobile flows.
branchesRouter.get("/me", requireRole("BRANCH"), getMyBranchController);

branchesRouter.get(
  "/",
  requireRole("ADMIN"),
  validateQuery(listBranchesQueryDto),
  listBranchesController,
);

branchesRouter.get(
  "/:id",
  requireRole("ADMIN"),
  validateParams(branchParamsDto),
  getBranchController,
);

branchesRouter.post(
  "/",
  requireRole("ADMIN"),
  validateBody(createBranchDto),
  createBranchController,
);

branchesRouter.patch(
  "/:id",
  requireRole("ADMIN"),
  validateParams(branchParamsDto),
  validateBody(updateBranchDto),
  updateBranchController,
);

branchesRouter.patch(
  "/:id/status",
  requireRole("ADMIN"),
  validateParams(branchParamsDto),
  validateBody(updateBranchStatusDto),
  updateBranchStatusController,
);

branchesRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  validateParams(branchParamsDto),
  deleteBranchController,
);
