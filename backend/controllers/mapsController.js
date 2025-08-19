// controllers/mapsController.js
const googleMapsConfig = require("../services/googleMapsConfig");

const getGoogleMapsScript = (req, res) => {
  try {
    const apiKey = googleMapsConfig.apiKey;
    if (!apiKey) {
      return res.status(500).json({ error: "Google Maps API key not configured." });
    }

    // Load both places + marker libraries
    const scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker`;

    return res.json({ scriptUrl });
  } catch (error) {
    console.error("Error generating Google Maps script URL:", error);
    return res.status(500).json({ error: "Failed to generate Google Maps script URL." });
  }
};

module.exports = {
  getGoogleMapsScript,
};
