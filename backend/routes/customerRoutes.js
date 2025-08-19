// customerRoutes.js
const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../services/authMiddleware");
const {
  getCustomerProfile,
  getSavedAddress,
  getCustomerOrders,
  addNewAddress,
  getCustomerOrderById,
    markOrderAsDelivered,
} = require("../controllers/customerController");

// existing route
router.get("/profile", getCustomerProfile);

// new: get customer saved addresses
router.get("/saved-address", authenticate,getSavedAddress);
router.get("/order/:orderId", authenticate, getCustomerOrderById);
router.get("/customer-orders", authenticate, getCustomerOrders);
router.patch("/:orderId/mark-delivered", authenticate, markOrderAsDelivered);

// new: save customer address
router.post("/save-address", authenticate, addNewAddress);

module.exports = router;
