import { Router } from "express";
import * as ctrl from "../controllers/availableMarketStock.controller";
import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

// Create/find doc for LC + date + shift
router.post("/available-stock/init", authenticate, authorize("fManager"), ctrl.initDoc);

// Read by LC + date + shift
router.get("/available-stock", authenticate, ctrl.getDoc);

// Next 5 shifts (by LC timezone) that have stock items
router.get("/available-stock/next-five-with-stock", authenticate, ctrl.listNextFiveWithStock);

// GET /api/market/available-stock/next5?LCid=LC-1
// Upcoming (today and forward) for LC
router.get("/available-stock/upcoming",authenticate, ctrl.listUpcoming);

// Add a line item to a doc
router.post("/available-stock/:docId/items", /*requireAuth,*/ ctrl.addItem);

// Update quantity/status of a line
router.patch("/available-stock/:docId/items/:lineId", /*requireAuth,*/ ctrl.updateLine);

// Remove a line item
router.delete("/available-stock/:docId/items/:lineId", /*requireAuth,*/ ctrl.removeLine);

export default router;
