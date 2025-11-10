import { Router } from "express";
import {
  postGeneratePickerTasks,
  getPickerTasksForShiftController,
  getShiftPickerTasksSummaryController,
  postClaimFirstReadyTaskForCurrentShift,
  postCompletePickerTaskForCurrentShift, 
} from "../controllers/pickerTasks.controller";
import { authenticate, authorize } from "../middlewares/auth";

const r = Router();

r.post("/generate", authenticate, authorize("admin", "opManager"), postGeneratePickerTasks);

r.get("/shift", authenticate, authorize("admin", "opManager"), getPickerTasksForShiftController);

r.get("/shift/summary", authenticate, authorize("admin", "opManager"), getShiftPickerTasksSummaryController);

// ✅ picker claims the first READY task for the *current* shift
r.post(
  "/shift/claim-first", authenticate, authorize("picker"),
  postClaimFirstReadyTaskForCurrentShift
);

// ✅ picker completes a task for the *current* shift
r.post(
  "/:taskId/complete", authenticate, authorize("picker","admin", "opManager"),
  postCompletePickerTaskForCurrentShift
);

export default r;
