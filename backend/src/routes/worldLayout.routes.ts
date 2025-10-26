// FILE: src/routes/worldLayout.routes.ts
import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth";
import * as ctrl from "../controllers/worldLayout.controller";

const router = Router();

// GET /api/world-layout/by-center/:centerId?minCellW=70&minCellH=66
router.get(
  "/by-center/:centerId",
  authenticate,
  authorize("opManager", "picker", "sorter", "admin"),
  ctrl.getByCenter
);

export default router;
