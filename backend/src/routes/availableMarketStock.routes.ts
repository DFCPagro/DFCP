import { Router } from "express";
import * as ctrl from "../controllers/availableMarketStock.controller";
import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

// Create/find doc for LC + date + shift
router.post("/available-stock/init", authenticate, authorize("fManager"), ctrl.initDoc);

// Read by LC + date + shift
router.get("/available-stock", authenticate, ctrl.getDoc);

// Next 5 shifts (by LC timezone) that have stock items
router.get("/available-stock/next5", authenticate, ctrl.listNextFiveWithStock);

// GET /api/market/available-stock/next5?LCid=LC-1
// Upcoming (today and forward) for LC
router.get("/available-stock/upcoming",authenticate, ctrl.listUpcoming);

router.post("/available-stock/adjustQty", authenticate, ctrl.adjustAvailableQty);


export default router;
