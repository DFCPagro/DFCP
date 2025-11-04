import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import validate from "../utils/validate";
import * as v from "../validations/shiftConfig.validation";
import * as ctrl from "../controllers/shiftConfig.controller";

const router = Router();


router.get("/windows", authenticate, ...v.windowsQuery, validate, ctrl.getShiftWindowsController);
router.get("/windows/all", authenticate, ...v.listAllQuery, validate, ctrl.listShiftWindowsByLCController);
router.get(
  "/next",
  authenticate,
  v.nextQuery,
  ctrl.getNextShiftsController
);
router.get("/current",  ctrl.getCurrentShiftController);

export default router;
