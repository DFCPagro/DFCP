const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../services/authMiddleware");
const {
  getAllDrivers,
  getAllShipments,
  getAllProblems,
  getAllSchedules,
  getDashboardOverview,
  resolveProblem,
  updateDriverStatus,
  getDriverRole,
} = require("../controllers/managerController");

// Apply authentication to all routes
router.use(authenticate);

// Apply role-based authorization for manager roles
router.use(requireRole(["admin", "transportationManager"]));

// Dashboard overview
router.get("/overview", getDashboardOverview);

// Drivers management
router.get("/drivers", getAllDrivers);
router.get("/driver-role/:driverId", getDriverRole);
router.put("/drivers/:driverId/status", updateDriverStatus);

// Shipments management
router.get("/shipments", getAllShipments);

// Problems management
router.get("/problems", getAllProblems);
router.put("/problems/:problemId/resolve", resolveProblem);

// Schedules management
router.get("/schedules", getAllSchedules);

module.exports = router;
