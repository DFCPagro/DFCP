const express = require("express");
const { getProfile,getEmailDocumnets,getApplication } = require("../controllers/userController");
const { authenticate } = require("../services/authMiddleware");
const router = express.Router();

router.get("/profile", authenticate, getProfile); // Gets his own profile
router.get("/application-statue", authenticate, getApplication); // Get user's employment application statue
router.get("/email-documents", getEmailDocumnets); // Gets his own profile

module.exports = router;
