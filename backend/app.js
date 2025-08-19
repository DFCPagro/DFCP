const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();

const path = require("path");

// Serve static files from FrontEnd folder
app.use(express.static(path.join(__dirname, "../FrontEnd")));

// Fallback to index.html for root path
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../FrontEnd/index.html"));
});

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require("./routes/userRoutes");
const farmerRoutes = require("./routes/farmerRoutes");
const farmerManagerRoutes = require("./routes/farmerManagerRoutes");
const customerRoutes = require("./routes/customerRoutes");
const marketRoutes = require("./routes/marketRoutes");
const mapsRoutes = require("./routes/mapsRouts");
const ordersRoutes = require("./routes/ordersRoutes");
const transporterRoutes = require("./routes/transporterRoutes");
const managerRoutes = require("./routes/managerRoutes");
//middlewares
app.use(cors());
app.use(express.json());

// Add middleware to log all requests
app.use((req, res, next) => {
  next();
});

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/farmer", farmerRoutes);
app.use("/api/farmerManager", farmerManagerRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/maps", mapsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/transporter", transporterRoutes);
app.use("/api/manager", managerRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
