// src/routes/pickerTasks.routes.ts
import { Router } from "express";
import { postGeneratePickerTasks,
  getPickerTasksForCurrentShift,
  getPickerTasksForShiftController, } from "../controllers/pickerTasks.controller";
import {authenticate, authorize} from "../middlewares/auth"; // should populate req.user and check JWT

const r = Router();

r.post("/generate", authenticate, authorize("admin", "opManager"), postGeneratePickerTasks);
r.get("/current", authenticate, authorize("admin", "opManager", "picker"), getPickerTasksForCurrentShift);
r.get("/shift", authenticate, authorize("admin", "opManager", "picker"), getPickerTasksForShiftController);


export default r;
