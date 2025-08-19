const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../services/authMiddleware");
const {
  updateApplicationStatus,
  getApplication,
  setRole,
  getProfileById,
  getAllUsers,
  getAllApplications,
  updateUser,
  deleteUser,
  getOrdersForUpcomingShifts,
  getOrdersForShift,
  getOrdersWithSummaryForShift,
  getShipments,
} = require("../controllers/adminController");

// router.post("/import-json", importJsonToFirestore);
router.get("/getShipments", authenticate, requireRole("admin"), getShipments);
/*DASHBOARD*/
router.get(
  "/orders-for-upcoming-shifts",
  authenticate,
  requireRole("admin"),
  getOrdersForUpcomingShifts
);
router.get(
  "/orders-for-shift",
  authenticate,
  requireRole("admin"),
  getOrdersForShift
);

router.get(
  "/orders-with-summary-for-shift",
  authenticate,
  requireRole("admin"),
  getOrdersWithSummaryForShift
);

/*JOB APPLICATION AND USER MANAGEMENT*/
router.put(
  "/updateApplication/:uid",
  authenticate,
  requireRole("admin"),
  updateApplicationStatus
); // Route restricted to admin for approving employee accounts
router.get("/application", authenticate, requireRole("admin"), getApplication); // Get user's employment application
router.post("/set-role", authenticate, requireRole("admin"), setRole);
router.get("/profile/:id", authenticate, requireRole("admin"), getProfileById); // get any user's profile
router.get("/users", authenticate, requireRole("admin"), getAllUsers); // get all users
router.get(
  "/getApplications",
  authenticate,
  requireRole("admin"),
  getAllApplications
); // get all employment applications
router.put("/users/:id", authenticate, requireRole("admin"), updateUser);
router.delete("/users/:id", authenticate, requireRole("admin"), deleteUser);

module.exports = router;
