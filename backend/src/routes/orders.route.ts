// src/routes/order.routes.ts
import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth";
import * as ctrl from "../controllers/orders.controller";

const router = Router();

router.use(authenticate);

router.post("/", ctrl.postCreateOrder);
// GET /api/orders/my?limit=15
router.get("/my", authenticate, ctrl.getMyOrders);

// NEW: summary (admin + csManager)
router.get("/summary",authorize("admin", "csManager"),ctrl.getOrdersSummary);


// NEW: list orders for a given LC + date + shift (admin + csManager)
router.get( "/by-shift",authorize("admin", "csManager"),ctrl.getOrdersForShift);
export default router;
