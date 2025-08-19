// logisticsRoutes.js

const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../services/authMiddleware");
const {
  listIncomingShipments,
  getShipmentDetails,
  receiveShipment,
  assignDriver,
  updateShipmentStatus,
  listOpenPicklists,
  getPicklist,
  updatePickItem,
  completePicklist,
} = require("../controllers/logisticsController");

router.use(authenticate);
router.use(requireRole(["sorting", "picker", "warehouse"]));

// Shipment management
router.get("/shipments/incoming", listIncomingShipments);
router.get("/shipments/:shipmentId", getShipmentDetails);
router.post("/shipments/:shipmentId/receive", receiveShipment);
router.post("/shipments/:shipmentId/assign-driver", assignDriver);
router.put("/shipments/:shipmentId/status", updateShipmentStatus);

// Picklist management
router.get("/picklists", listOpenPicklists);
router.get("/picklists/:picklistId", getPicklist);
router.put("/picklists/:picklistId/item/:itemId", updatePickItem);
router.post("/picklists/:picklistId/complete", completePicklist);

module.exports = router;
