// routes/jobApplication.route.ts
import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth";
import validate from "../utils/validate";
import * as v from "../validations/jobApplication.validation";
import * as ctrl from "../controllers/jobApplication.controller";
import { Role } from "../utils/constants";

const router = Router();

const MUTATION_ROLES = [
  "tManager",
  "fManager",
  "opManager",
  "admin",
] as const satisfies Role[];

router.post(
  "/",
  authenticate,
  ...v.createJobApplicationValidation,
  validate,
  ctrl.create
);

router.get(
  "/manager",
  authenticate,
  authorize(...MUTATION_ROLES),
  ...v.adminListJobApplicationsValidation,
  validate,
  ctrl.adminList
);

router.get(
  "/manager/:id",
  authenticate,
  authorize(...MUTATION_ROLES),
  ...v.idParamValidation,
  validate,
  ctrl.adminRead
);

router.patch(
  "/manager/:id/status",
  authenticate,
  authorize(...MUTATION_ROLES),
  ...v.adminStatusUpdateValidation,
  validate,
  ctrl.adminPatchStatus
);

router.patch(
  "/manager/:id",
  authenticate,
  authorize(...MUTATION_ROLES),
  ...v.adminUpdateJobApplicationValidation,
  validate,
  ctrl.adminPatchMeta
);

export default router;
