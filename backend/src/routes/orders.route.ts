// src/routes/order.routes.ts
import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth";
import * as ctrl from "../controllers/orders.controller";

const STAFF = ["opManager", "dManager", "fManager", "admin"] as const;
const COURIERS = ["deliverer", "industrialDeliverer"] as const;

const router = Router();

router.use(authenticate);

router.post("/", authorize("customer"), ctrl.create);
router.get("/", authorize(...STAFF, "customer", ...COURIERS, "farmer"), ctrl.list);
router.get("/my", authorize(...STAFF, "customer", ...COURIERS, "farmer"), ctrl.listMine);
router.get("/:id", authorize(...STAFF, "customer", ...COURIERS, "farmer"), ctrl.getOne);
router.patch("/:id", authorize(...STAFF, "customer"), ctrl.updateGeneral);
router.patch("/:id/status", authorize(...STAFF, ...COURIERS), ctrl.setStatus);
router.patch("/:id/assign-deliverer", authorize("opManager", "dManager", "admin"), ctrl.setDeliverer);
router.post("/:id/audit", authorize(...STAFF, "customer", ...COURIERS, "farmer"), ctrl.addAudit);
router.post("/:id/cancel", authorize(...STAFF, "customer"), ctrl.cancel);

export default router;
