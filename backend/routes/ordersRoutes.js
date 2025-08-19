const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../services/authMiddleware");
const {
     getAllOrdersForShifts,
     getOrdersForShift,
     getOrdersWithSummaryForShift,
     getOrdersForUpcomingShifts,
     getOrdersGroupedByFarmerForShift,
} = require("../controllers/ordersController");

router.get("/getAllOrdersForShifts", authenticate, getAllOrdersForShifts);
router.get("/getOrdersForShift", authenticate, getOrdersForShift);
router.get("/orders-with-summary-for-shift", authenticate,getOrdersWithSummaryForShift);
router.get("/orders-for-upcoming-shifts", authenticate,getOrdersForUpcomingShifts);
router.get('/orders-grouped-by-farmer', getOrdersGroupedByFarmerForShift);

module.exports = router;