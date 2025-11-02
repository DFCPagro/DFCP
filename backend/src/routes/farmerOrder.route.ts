// src/routes/farmer.routes.ts
import { Router } from "express";
import {
  create,
  updateFarmerStatus,
 
  getFarmerOrdersUpcoming,
  getFarmerOrdersForShift,
  initContainersForFarmerOrder,
  updateContainerWeights,
  listMyOrders,
  getFarmerOrderAndQrs,
} from "../controllers/farmerOrder.controller";
// import { listMyOrders, getOrderAndQrs } from "../controllers/ops.controller";
import { authenticate, authorize } from "../middlewares/auth";
import { patchFarmerOrderStage } from "../controllers/farmerOrderStages.controller";



const router = Router();

// Role shortcuts
const FM = authorize("fManager", "admin");
const FARMER = authorize("farmer", "fManager", "admin");
const FARMER_READS = authorize("farmer", "fManager", "admin");

// Health
router.get("/__health", (_req, res) =>
  res.json({ ok: true, route: "farmer.routes.__health" })
);

// Summaries
router.get("/summary", authenticate, authorize("admin", "fManager"), getFarmerOrdersUpcoming);
router.get("/by-shift", authenticate, authorize("admin", "fManager"), getFarmerOrdersForShift);

// Writes
router.post("/", authenticate, FM, create);
router.patch("/:id/farmer-status", authenticate, FM, updateFarmerStatus);
//router.patch("/:id/stage", authenticate, FM, updateStageStatus);
router.patch(
  "/:id/stage",
  authorize("fManager", "admin"),
  patchFarmerOrderStage
);
// Reads
router.get("/", authenticate, FARMER_READS, listMyOrders);
router.get("/:id/print", authenticate, FARMER_READS, getFarmerOrderAndQrs);


// --- Containers: Farmer Report Flow ---
router.post("/:id/containers/init", authenticate, FARMER, initContainersForFarmerOrder);
router.patch("/:id/containers/weights", authenticate, FARMER, updateContainerWeights);


export default router;
