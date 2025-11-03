// src/routes/pickerTasks.routes.ts
import { Router } from "express";
import { postGeneratePickerTasks,
  getPickerTasksForCurrentShift,
  getPickerTasksForShiftController, } from "../controllers/pickerTasks.controller";
import {authorize} from "../middlewares/auth"; // should populate req.user and check JWT

const r = Router();

r.post("/generate", authorize("admin", "opManager"), postGeneratePickerTasks);
r.get("/current", authorize("admin", "opManager", "picker"), getPickerTasksForCurrentShift);
r.get("/shift", authorize("admin", "opManager", "picker"), getPickerTasksForShiftController);


export default r;
