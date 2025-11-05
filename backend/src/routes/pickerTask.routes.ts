// src/routes/pickerTasks.routes.ts
import { Router } from "express";
import { postGeneratePickerTasks,
  getPickerTasksForShiftController, } from "../controllers/pickerTasks.controller";
import {authenticate, authorize} from "../middlewares/auth"; // should populate req.user and check JWT

const r = Router();

r.post("/generate", authenticate, authorize("admin", "opManager"), postGeneratePickerTasks);

r.get("/shift", authenticate, authorize("admin", "opManager", "picker"), getPickerTasksForShiftController);


export default r;
