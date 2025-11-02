import { Router } from "express";
import authRoutes from "./auth.route";
import orderRoutes from "./orders.route";
import itemRoutes from "./items.route";
import jobApplicationRouter from "./jobApplication.route";
import logisticsCenterRouter from "./logisticsCenter.route";
import centerMapRoutes from "./centerMap.routes";
import marketRoutes from "./availableMarketStock.routes";
import delivererRoutes from "./deliverer.routes";
import shiftRoutes from "./shiftConfig.route";
import userRoutes from "./user.route";

import configRoutes from "./config.routes";
import farmerOrderRoutes from "./farmerOrder.route";
import PackageSizeRoute from "./packageSize.route";
import ItemPackingRoute from "./ItemPacking.route";
import farmerRoute from "./farmer.routes";
import scanRoute from "./scan.routes";
import industrialDelivererRoute from "./industrialDeliverer.routes";
import shelfRoutes from "./shelf.routes";
import containerOpsRoutes from "./containerOps.routes";
import pickTaskRoutes from "./pickTask.routes";
import reconciliationRoutes from "./reconciliation.routes";
import farmerInventoryRoutes from "./farmerInventory.route";
import worldLayoutRoutes from "./worldLayout.routes";
import demandStaticsRoutes from "./demandStatics.routes";
import pickerRoutes from "./picker.routes";
import deliveryShelvingRoutes from "./deliveryShelving.routes";

const router = Router();

router.use("/auth", authRoutes);

router.use("/logistics-centers", logisticsCenterRouter);
router.use("/picker", pickerRoutes);
router.use("/pick-tasks", pickTaskRoutes);
router.use("/delivery-shelving", deliveryShelvingRoutes);

// 🧱 Warehouse / LC ops
router.use("/shelves", shelfRoutes); // /shelves/:id, /shelves/:id/slots/place, etc.
router.use("/container-ops", containerOpsRoutes); // /container-ops/:id/pick, /container-ops/:id/mark-depleted
router.use("/world-layout", worldLayoutRoutes);

// Existing
router.use("/items", itemRoutes);
router.use("/demand-statics", demandStaticsRoutes);

router.use("/orders", orderRoutes);
router.use("/market", marketRoutes);
router.use("/deliverers", delivererRoutes);

router.use("/config", configRoutes);
router.use("/farmer-orders", farmerOrderRoutes);
router.use("/package-sizes", PackageSizeRoute);
router.use("/item-packing", ItemPackingRoute);
router.use("/farmer", farmerRoute);
router.use("/industrialDeliverer", industrialDelivererRoute);
router.use("/scan", scanRoute);
// router.use(centerMapRoutes);
router.use("/shifts", shiftRoutes);
router.use("/users", userRoutes);
router.use("/pick-tasks", pickTaskRoutes);
router.use("/containers", reconciliationRoutes);
router.use("/farmer-inventory", farmerInventoryRoutes);
router.use("/jobApp", jobApplicationRouter);

export default router;
