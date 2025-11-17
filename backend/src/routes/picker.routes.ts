import { Router } from "express";
import {
  getMe,
  getTopPickersByCompletedOrdersHandler,
  getCurrentShiftOrdersForPicker,
  patchMe,
  patchMeGamification
} from "@/controllers/picker.controller";
import { authenticate, authorize } from "@/middlewares/auth";

const router = Router();

/**
 * Role policy:
 * - GET profile: any authenticated user (maybe they’re about to apply/upgrade)
 * - POST/PUT/PATCH picker: picker themselves or staff/admin
 */
const STAFF_ROLES = ["admin", "opManager", "tManager", "fManager", "csManager"] as const;
const PICKER_WRITE_ROLES = ["picker", ...STAFF_ROLES] as const;

router.get("/me", authenticate, getMe);
router.patch("/me", authenticate, authorize(...PICKER_WRITE_ROLES as any), patchMe);
router.patch(
  "/me/gamification",
  authenticate,
  authorize(...PICKER_WRITE_ROLES as any),
  patchMeGamification
);

// e.g. GET /pickers/top?mode=todayShift&logisticCenterId=...&limit=5
//      GET /pickers/top?mode=month&month=11&year=2025&logisticCenterId=...
router.get("/top", authenticate, getTopPickersByCompletedOrdersHandler);
router.get("/:id/orders/current-shift", authenticate, getCurrentShiftOrdersForPicker);



export default router;
