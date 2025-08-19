const express = require("express");
const router = express.Router();
const {
  registerCustomer,
  requestEmployment,
  getUserRole,
  login,
} = require("../controllers/authController");
const { authenticate } = require("../services/authMiddleware");

// Customer and employee registration routes
router.post("/register-customer", registerCustomer); // for customers
router.post("/register-employee", requestEmployment); // for job applicants
router.post("/get-role", getUserRole);
router.post("/login", authenticate, login); // login
module.exports = router;
