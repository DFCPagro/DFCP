const express = require("express");
const router = express.Router();
const { authenticate } = require("../services/authMiddleware");
const {
    getAvailableStock,
  getAvailableShifts,
  getItemList,
    reserveItem,
    restoreItem,
    submitOrder,
} = require("../controllers/marketController");



// new: get available shifts for market
router.get("/available-shifts", authenticate, getAvailableShifts);
router.get("/available-stock/:stockId", authenticate, getAvailableStock);
router.get("/items", authenticate, getItemList); // NEW LINE
router.post("/reserve-item", authenticate, reserveItem);
router.post("/restore-item", authenticate, restoreItem);
router.post("/submit-order", authenticate, submitOrder);

module.exports = router;
