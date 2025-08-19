require("dotenv").config();

const googleMapsConfig = {
  apiKey: process.env.GOOGLE_MAPS_API_KEY,
};

module.exports = googleMapsConfig;
