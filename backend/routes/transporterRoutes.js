const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../services/authMiddleware");
const {
  upsertTransporterProfile,
  getMyTransporterProfile,
  listAvailableShipments,
  acceptShipment,
  getMyShipments,
  updateShipmentStatus,
  // Schedule management
  getAvailableShifts,
  getMonthlySchedule,
  updateMonthlyScheduleDate,
  updateStandbyShifts,
  // Deliverer-specific
  logArrival,
  getPickupNotifications,
  confirmPickup,
  confirmDelivery,
  getPickupLocation,
  getDeliveryRoute,
  // Industrial driver-specific
  getAvailablePickups,
  startShift,
  getDepartureAlerts,
  confirmPickupLocation,
  getPickupRoute,
  // Performance tracking
  getPerformanceMetrics,
  // Utility functions
  getDriverInfo,
  getVehicleTypes,
  getUserSchedule,
  saveWeeklySchedule,
  saveMonthlySchedule,
  validateContainerQRCodes,
  calculateBoxVolume,
  verifyShipmentQRCodes,
} = require("../controllers/transporterController");

// Apply authentication to all routes
router.use(authenticate);

// Apply role-based authorization for transporter roles
router.use(requireRole(["industrialDriver", "deliverer"]));

// Transporter profile routes
router.post("/profile", upsertTransporterProfile);
router.get("/profile", getMyTransporterProfile);
router.post("/calculate-volume", calculateBoxVolume);

// Schedule management routes (shared)
router.get("/available-shifts", getAvailableShifts);
router.get("/schedule/monthly", getMonthlySchedule);
router.put("/schedule/monthly/:date", updateMonthlyScheduleDate);
router.put("/standby-shifts", updateStandbyShifts);
router.get("/schedule", getUserSchedule);
router.post("/schedule/weekly", saveWeeklySchedule);
router.post("/schedule/monthly", saveMonthlySchedule);

// Shipment management routes (shared)
router.get("/available-shipments", listAvailableShipments);
router.post("/accept-shipment/:shipmentId", acceptShipment);
router.get("/my-shipments", getMyShipments);
router.put("/shipment/:shipmentId/status", updateShipmentStatus);
router.post("/shipments/:shipmentId/verify-qr", verifyShipmentQRCodes); // ← NEW QR verification route

// Deliverer-specific routes
router.post("/check-in", logArrival);
router.get("/pickup-notifications", getPickupNotifications);
router.get("/pickup-location/:orderId", getPickupLocation);
router.post("/pickup-confirm/:orderId", confirmPickup);
router.get("/delivery-route/:deliveryId", getDeliveryRoute);
router.post("/delivery-confirm/:orderId", confirmDelivery);

// Industrial driver-specific routes
router.get("/available-pickups", getAvailablePickups);
router.post("/shift-start", startShift);
router.get("/departure-notifications", getDepartureAlerts);
router.get("/pickup-route/:shipmentId", getPickupRoute);
router.post("/pickup-location/:shipmentId", confirmPickupLocation);

// Performance tracking (shared)
router.get("/performance", getPerformanceMetrics);

// Utility routes (shared)
router.get("/vehicle-types", getVehicleTypes);

module.exports = router;
