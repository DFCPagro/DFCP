// mapsRoutes.js
const express = require("express");
const router = express.Router();
const { authenticate } = require("../services/authMiddleware");
const { getGoogleMapsScript } = require("../controllers/mapsController");

// get Google Maps script URL (you can protect it with authenticate if needed)
router.get("/google-maps-script", getGoogleMapsScript);

module.exports = router;
