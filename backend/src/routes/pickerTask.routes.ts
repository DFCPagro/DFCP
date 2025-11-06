import { Router } from "express";
import {
  postGeneratePickerTasks,
  getPickerTasksForShiftController,
  getShiftPickerTasksSummaryController,
  postClaimFirstReadyTaskForCurrentShift, // ⬅️ add
} from "../controllers/pickerTasks.controller";
import { authenticate, authorize } from "../middlewares/auth";

const r = Router();

r.post("/generate", authenticate, authorize("admin", "opManager"), postGeneratePickerTasks);

r.get("/shift", authenticate, authorize("admin", "opManager", "picker"), getPickerTasksForShiftController);

r.get("/shift/summary", authenticate, authorize("admin", "opManager", "picker"), getShiftPickerTasksSummaryController);

// ✅ picker claims the first READY task for the *current* shift
r.post(
  "/shift/claim-first", authenticate, authorize("picker"),
  postClaimFirstReadyTaskForCurrentShift
);

export default r;
