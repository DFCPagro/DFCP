import { Router } from "express";
import * as ctrl from "../controllers/logisticsCenter.controller";
import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

// Read: any authenticated user
router.get("/", authenticate, ctrl.list);
router.get("/:id", authenticate, ctrl.getById);

// Create/Update: managers + admin
router.post("/", authenticate, authorize("tManager", "opManager", "admin"), ctrl.create);
router.patch("/:id", authenticate, authorize("tManager", "opManager", "admin"), ctrl.update);

// Delete: opManager + admin
router.delete("/:id", authenticate, authorize("opManager", "admin"), ctrl.remove);

// Delivery history: managers + admin
router.post("/:id/delivery-history", authenticate, authorize("tManager", "opManager", "admin"), ctrl.addDeliveryHistory);

// Associations: center ↔ deliverers (managers + admin)
router.get("/:id/deliverers", authenticate, authorize("tManager", "opManager", "admin"), ctrl.listDeliverers);
router.post("/:id/deliverers/:delivererId", authenticate, authorize("tManager", "opManager", "admin"), ctrl.assignDeliverer);
router.delete("/:id/deliverers/:delivererId", authenticate, authorize("tManager", "opManager", "admin"), ctrl.unassignDeliverer);

export default router;
