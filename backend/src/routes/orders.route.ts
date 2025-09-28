// src/routes/order.routes.ts
import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth";
import * as ctrl from "../controllers/orders.controller";

const STAFF = ["opManager", "tManager", "fManager", "admin"] as const;
const COURIERS = ["deliverer", "industrialDeliverer"] as const;

const router = Router();

router.use(authenticate);

router.post("/",ctrl.postCreateOrder);
// GET /api/orders/my?limit=15
router.get("/my", authenticate, ctrl.getMyOrders);


export default router;
