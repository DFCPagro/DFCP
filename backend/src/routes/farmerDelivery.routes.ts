// src/routes/farmerDelivery.routes.ts

import { Router } from "express";
import {
  getFarmerDeliveryDashboard,
  postPlanFarmerDeliveries,
  getFarmerDeliveriesByShiftHandler,
} from "../controllers/farmerDelivery.controller";
import { authenticate, authorize, authenticateIfPresent } from "@/middlewares/auth";
// optional: authorize T-manager role, etc.

const router = Router();

router.use(authenticate);

// T-manager dashboard summary
router.get("/summary",authorize("tManager", "admin") ,getFarmerDeliveryDashboard);

// Ensure plan for a specific shift
router.post("/plan", authorize("tManager", "admin"),postPlanFarmerDeliveries);

// View deliveries for specific shift
router.get(
  "/by-shift",authorize("tManager", "admin"),
  getFarmerDeliveriesByShiftHandler
);

export default router;
