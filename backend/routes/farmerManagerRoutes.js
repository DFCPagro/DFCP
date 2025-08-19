const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../services/authMiddleware");
const {
  getDashboardStatus,
  getDemandStatistics,
  getFarmerInventory,
  createStockItem,
  getShipmentRequestsForShift,
  shipmentRequestQuantitiesConfirmed,
  getApplication,
  getAllUsers,
  updateAggrementPrecentage,
  updateApplicationStatus,
  getAllItems,
  addNewItem,
  updateItem,
  deleteItem,
  getOrdersSummaryForShift,
} = require("../controllers/farmerManagerController");

router.get("/dashboardStatus", getDashboardStatus);
router.get("/demandStatistics", authenticate, requireRole("farmerManager"), getDemandStatistics);
router.get("/farmerInventory", getFarmerInventory);
router.post("/createStockItem", authenticate, createStockItem);
router.get("/shipmentRequests", getShipmentRequestsForShift);
router.post(
  "/shipmentRequestQuantitiesConfirmed",
  shipmentRequestQuantitiesConfirmed
);

router.get("/orders-summary-for-shift", authenticate, requireRole("farmerManager"),
getOrdersSummaryForShift)


router.put(
  "/updateApplication/:uid",
  authenticate,
  requireRole("farmerManager"),
  updateApplicationStatus
);

router.get(
  "/getAllUsers",
  authenticate,
  requireRole("farmerManager"),
  getAllUsers
);
router.get(
  "/getApplications",
  authenticate,
  requireRole("farmerManager"),
  getApplication
);

router.put(
  "/updateAggrement/:uid",
  authenticate,
  requireRole("farmerManager"),
  updateAggrementPrecentage
);



router.get("/items", getAllItems ,requireRole("farmerManager"));
router.post("/items", addNewItem ,requireRole("farmerManager"));
router.put("/items/:id", updateItem ,requireRole("farmerManager"));

router.delete(
  "/items/:itemId",
  authenticate,
  requireRole("farmerManager"),
  deleteItem
);

module.exports = router;
