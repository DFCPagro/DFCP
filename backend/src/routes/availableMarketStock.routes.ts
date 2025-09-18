import { Router } from "express";
import * as ctrl from "../controllers/availableMarketStock.controller";
import { authenticate, authorize } from "../middlewares/auth";
import { ro } from "@faker-js/faker/.";

const router = Router();

// Create/find doc for LC + date + shift
router.post("/available-stock/init", authenticate, authorize("fManager"), ctrl.initDoc);

// Read by LC + date + shift
router.get("/available-stock", authenticate, ctrl.getDoc);

// Next 5 shifts (by LC timezone) that have stock items for customer to order from
router.get("/available-stock/next5", authenticate, ctrl.listNextFiveWithStock);


// GET /api/market/available-stock/:docId
router.get("/available-stock/:docId", authenticate, ctrl.getStockById);


// Upcoming (today and forward) for LC
router.get("/available-stock/upcoming",authenticate, ctrl.listUpcoming);

//remove if we create the cart model
router.post("/available-stock/adjustQty", authenticate, ctrl.adjustAvailableQty);


export default router;
