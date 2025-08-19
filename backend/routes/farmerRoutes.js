const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../services/authMiddleware");
const {
  createCropByLandId,
  approveShipmentRequest,
  submitShipmentReport,
  getApprovedShipments,
  getShipmentRequests,
  getFarmerLands,
  getItemList,
  updateCropByLandId,
  deleteCropByLandId,
  getApprovedShipmentsByID,
  getCustomerOrderById,
} = require("../controllers/farmerController");
router.use(authenticate);

router.get("/order/:orderId", authenticate, getCustomerOrderById);

router.post(
  "/submitShipmentReport",
  authenticate,
  requireRole("farmer"),
  submitShipmentReport
);

router.get(
  "/getApprovedShipments",
  authenticate,
  requireRole("farmer"),
  getApprovedShipments
);

router.get(
  "/getApprovedShipmentsByID/:shipmentId",
  authenticate,
  requireRole("farmer"),
  getApprovedShipmentsByID
);

router.get(
  "/getShipmentRequests",
  authenticate,
  requireRole("farmer"),
  getShipmentRequests
);

router.get(
  "/getFarmerLands",
  authenticate,
  requireRole("farmer"),
  getFarmerLands
);

router.put(
  "/updateCrops/:landId",
  authenticate,
  requireRole("farmer"),
  updateCropByLandId
);

router.delete(
  "/removeLandCrops/:landId",
  authenticate,
  requireRole("farmer"),
  deleteCropByLandId
);

router.post(
  "/addCrop",
  authenticate,
  requireRole("farmer"),
  createCropByLandId
);

router.put(
  "/approveShipmentRequest/:requestId",
  authenticate,
  requireRole("farmer"),
  approveShipmentRequest
);

router.get("/getItemList", getItemList);

module.exports = router;
