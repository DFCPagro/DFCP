const { db, admin } = require("../firebaseConfig");
const { DateTime } = require("luxon");
const QRCode = require("qrcode");

// --- Helper Functions ---

// Get farmer's lands from extraFields
async function getFarmerLandsByUid(farmerId) {
  const farmerDoc = await db.collection("farmers").doc(farmerId).get();
  if (!farmerDoc.exists) {
    throw new Error("Farmer not found");
  }

  const farmerData = farmerDoc.data();
  return farmerData.extraFields?.lands || [];
}

// Update farmer's lands in extraFields
async function updateFarmerLands(farmerId, lands) {
  const farmerRef = db.collection("farmers").doc(farmerId);

  // Convert any FieldValue.serverTimestamp() to actual timestamp before saving
  const cleanedLands = lands.map((land) => {
    if (
      land.crop &&
      land.crop.updatedAt &&
      land.crop.updatedAt.constructor &&
      land.crop.updatedAt.constructor.name === "FieldValue"
    ) {
      // Replace FieldValue.serverTimestamp() with actual timestamp
      return {
        ...land,
        crop: {
          ...land.crop,
          updatedAt: admin.firestore.Timestamp.now(),
        },
      };
    }
    return land;
  });

  try {
    await farmerRef.update({
      "extraFields.lands": cleanedLands,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
}

// Inventory management helper function
async function manageInventory(farmerId, crop, landIndex, action) {
  try {
    const inventoryRef = db.collection("farmerInventory");
    const cropId = `${farmerId}_${crop.itemId}`; // Use farmerId, itemId, and landIndex to create unique cropId

    const farmer = await db.collection("farmers").doc(farmerId).get();
    const User = await db.collection("users").doc(farmerId).get();
    const userData = User.data();
    if (!farmer.exists) {
      return res.status(404).send({ error: "Farmer not found" });
    }
    const farmerData = farmer.data();
    const lands = farmerData.extraFields?.lands || [];
    const pickupAddress = lands[landIndex].pickupAddress || "Unknown Address";
    const agreementPercentage = (farmerData.agreementPercentage || 60) / 100; // Default to 60% if not set
    const currentAvailableForProcurementKg =
      (crop.expectedHarvestingKg * crop.statusPercentage) / 10;
    if (action === "add") {
      // Add to inventory when harvesting
      const inventoryData = {
        farmerName:
          userData.firstName + " " + userData.lastName || "Unknown Farmer",
        farmerId: farmerId,
        logisticCenterId: "LC-1",
        itemId: crop.itemId,
        currentAvailableForProcurementKg: currentAvailableForProcurementKg,
        maxOrder: currentAvailableForProcurementKg * agreementPercentage || 60, // Default to 60% of expected harvesting
        status: crop.status,
        statusPercentage: crop.statusPercentage || 0,
        harvestedDate: admin.firestore.Timestamp.now(),
        addedToInventory: admin.firestore.Timestamp.now(),
        pickupAddress,
      };

      await inventoryRef.doc(cropId).set(inventoryData);
      //console.log(`✅ Added crop ${cropId} to farmer inventory`);
    } else if (action === "remove") {
      // Remove from inventory when field clearing or 100% harvested
      const docRef = inventoryRef.doc(cropId);
      const docSnapshot = await docRef.get();

      if (docSnapshot.exists) {
        await docRef.delete();
        //console.log(`✅ Removed crop ${cropId} from farmer inventory`);
      } else {
        //console.log(`⚠️ Crop ${cropId} not found in inventory, nothing to remove`);
      }
    }
  } catch (error) {
    console.error("❌ Error managing inventory:", error);
    throw error;
  }
}

// Submit Shipment Report
//TODO comeback after Barcode gen
async function submitShipmentReport(req, res) {
  try {
    // === Auth Check ===
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const farmerUid = decodedToken.uid;

    // === Get Payload ===
    const { shipmentId, totalWeightReported, containers, readyTimestamp } =
      req.body;

    if (!shipmentId || !Array.isArray(containers) || containers.length === 0) {
      return res.status(400).json({ error: "Missing or invalid payload" });
    }

    const shipmentRef = db.collection("shipment").doc(shipmentId);
    const shipmentSnap = await shipmentRef.get();

    if (!shipmentSnap.exists) {
      return res.status(404).json({ error: "Shipment not found" });
    }

    const shipmentData = shipmentSnap.data();

    if (shipmentData.farmerId !== farmerUid) {
      return res
        .status(403)
        .json({ error: "Unauthorized to update this shipment" });
    }

    const timestampNow = admin.firestore.Timestamp.now();

    // === Prepare Updates ===
    const newHistoryEntry = {
      timestamp: timestampNow,
      user: "farmer",
      action: `Submitted ${containers.length} containers (${totalWeightReported} kg)`,
    };

    const updatedStages = shipmentData.stages.map((stage) =>
      stage.key === "ready-for-pickup"
        ? { ...stage, timestamp: timestampNow, status: "ok" }
        : stage
    );

    // Append to farmerReports in fullReport
    const updatedFullReport = {
      ...shipmentData.fullReport,
      farmerReports: [
        ...(shipmentData.fullReport?.farmerReports || []),
        {
          submittedAt: timestampNow,
          totalWeightReported,
          containers,
        },
      ],
      history: [...(shipmentData.fullReport?.history || []), newHistoryEntry],
    };

    const farmerShipmentDoc = {
      id: shipmentId,
      approvedAt: shipmentData.approvedAt?.toDate().toISOString() || null,
      createdAt: shipmentData.createdAt?.toDate().toISOString() || null,
      updatedAt: timestampNow.toDate().toISOString(),
      pickupTime: shipmentData.pickupTime || null,
      destination: shipmentData.destination || null,
      farmerId: farmerUid,
      driver: shipmentData.driver || null,
      reportSubmittedAt: timestampNow.toDate().toISOString(),
      reportSubmittedBy: farmerUid,
      reportNotes: "",
      reportedWeight: totalWeightReported,
      totalWeight: totalWeightReported,
      totalVolume: totalWeightReported, // Change this logic if volume ≠ weight
      status: "available_shipment",
      items: shipmentData.itemId
        ? [
            {
              name: shipmentData.itemDisplayName,
              quantity: totalWeightReported,
            },
          ]
        : [],
      containers: containers,
    };

    await db
      .collection("farmer_shipments")
      .doc(shipmentId)
      .set(farmerShipmentDoc);

    // === Final Firestore Update ===
    await shipmentRef.update({
      "fullReport.farmerReports": updatedFullReport.farmerReports,
      "fullReport.history": updatedFullReport.history,
      stages: updatedStages,
      overallStatus: "ready-for-pickup", // optional depending on your logic
      lastUpdatedAt: new Date().toISOString(),
    });

    return res
      .status(200)
      .json({ message: "Shipment report submitted successfully" });
  } catch (err) {
    console.error("[submitShipmentReport] Error:", err);
    return res.status(500).json({ error: err.message });
  }
}

//AFTER FIXES functions to keep :-

async function getApprovedShipments(req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const farmerUid = decodedToken.uid;

    // Get shipments
    const shipmentsSnapshot = await db
      .collection("shipment")
      .where("farmerId", "==", farmerUid)
      .get();

    // .where("overallStatus", "==", "at-farm")

    // Filter and format approved shipments
    const approvedShipments = shipmentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(approvedShipments);
  } catch (err) {
    console.error("[getApprovedShipments] Error:", err);
    res.status(500).send({ error: err.message });
  }
}

async function getApprovedShipmentsByID(req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const farmerUid = decodedToken.uid;

    const { shipmentId } = req.params;

    const approvedShipmentSnap = await db
      .collection("shipment")
      .doc(shipmentId)
      .get();

    if (!approvedShipmentSnap.exists) {
      return res.status(404).json({ error: "Shipment not found" });
    }

    const approvedShipment = approvedShipmentSnap.data();

    if (approvedShipment.farmerId !== farmerUid) {
      return res.status(403).send("Farmer IDs don't match");
    }

    res.json(approvedShipment);
  } catch (err) {
    console.error("[getApprovedShipments] Error:", err);
    res.status(500).send({ error: err.message });
  }
}

async function getShipmentRequests(req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const farmerUid = decodedToken.uid;

    console.log(
      `[getShipmentRequests] Fetching requests for farmer: ${farmerUid}`
    );
    // Step 1: Fetch all shift data
    const shiftsSnapshot = await db.collection("shifts").get();
    const shifts = {};
    shiftsSnapshot.forEach((doc) => {
      shifts[doc.id] = doc.data(); // { start: "07:00", end: "13:00" }
    });

    // Step 2: Determine current time and next shift
    const now = DateTime.local(); // current time
    const today = now.startOf("day");

    const shiftEntries = Object.entries(shifts).map(([name, times]) => {
      const start = DateTime.fromFormat(times.start, "HH:mm");
      return { name, startTime: start };
    });

    // Sort shifts by start time
    shiftEntries.sort(
      (a, b) => a.startTime.toMillis() - b.startTime.toMillis()
    );

    // Determine next shift
    let nextShift = null;
    let referenceDate = today;

    for (let shift of shiftEntries) {
      const shiftStartToday = today.plus({
        hours: shift.startTime.hour,
        minutes: shift.startTime.minute,
      });
      if (now < shiftStartToday) {
        nextShift = shift.name;
        break;
      }
    }

    // If current time is after all shift starts, move to tomorrow's first shift
    if (!nextShift) {
      nextShift = shiftEntries[0].name;
      referenceDate = today;
    }

    // Step 3: Fetch all shipment requests for the farmer
    const shipmentsSnapshot = await db
      .collection("shipmentRequests")
      .where("farmerId", "==", farmerUid)
      .get();

    // Step 4: Filter and format relevant shipments
    const filtered = shipmentsSnapshot.docs
      .filter((doc) => {
        const data = doc.data();
        const status = data.status;
        if (status !== "forecasted" && status !== "finalized") return false;

        console.log(`[getShipmentRequests] Request status: ${status}`);
        // Check if the scheduled pickup date
        const pickupDate = DateTime.fromISO(data.scheduledPickupDate).startOf(
          "day"
        );
        const shiftName = data.scheduledPickupTimeSlot; // e.g., "afternoon" from "wednesday-afternoon"

        return (
          pickupDate >= referenceDate ||
          (pickupDate.equals(referenceDate) && shiftName === nextShift)
        );
      })
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

    res.json(filtered);
  } catch (err) {
    console.error("[getShipmentRequests] Error:", err);
    res.status(500).send({ error: err.message });
  }
}

async function getFarmerLands(req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const farmerUid = decodedToken.uid;

    const farmerDoc = await db.collection("farmers").doc(farmerUid).get();
    if (!farmerDoc.exists) {
      throw new Error("Farmer not found");
    }

    const farmerData = farmerDoc.data();
    lands = farmerData.extraFields?.lands || [];
    lands = lands.map((land, index) => ({
      ...land,
      id: `land-${index}`,
    }));
    res.json(lands);
  } catch (err) {
    console.error("[getFarmerLands] Error:", err);
    res.status(500).send({ error: err.message });
  }
}

const getItemList = async (req, res) => {
  try {
    const itemsSnapshot = await db.collection("items").get();

    const itemsData = itemsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(itemsData);
  } catch (err) {
    console.error("Error fetching all inventory:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

async function deleteCropByLandId(req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const farmerUid = decodedToken.uid;
    const { landId } = req.params;

    const index = parseInt(landId.split("-")[1]);
    const lands = await getFarmerLandsByUid(farmerUid);

    if (isNaN(index) || index < 0 || index >= lands.length) {
      return res.status(404).json({ error: "Invalid landId" });
    }

    const land = lands[index];
    if (!land.crop) {
      return res.status(404).json({ error: "No crop found in this land" });
    }

    try {
      await manageInventory(farmerUid, land.crop, index, "remove");
    } catch (err) {
      console.warn(
        "[deleteCropByLandId] Inventory removal failed:",
        err.message
      );
    }

    delete lands[index].crop;

    await updateFarmerLands(farmerUid, lands);

    res.json({ message: "Crop removed successfully" });
  } catch (err) {
    console.error("[deleteCropByLandId] Error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function updateCropByLandId(req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const farmerUid = decodedToken.uid;
    const { landId } = req.params; // e.g., "land-0"
    const updateData = req.body;

    const lands = await getFarmerLandsByUid(farmerUid);

    const index = parseInt(landId.split("-")[1]); // ✅ FIXED HERE
    if (isNaN(index) || index < 0 || index >= lands.length) {
      return res.status(404).json({ error: "Invalid landId" });
    }

    const land = lands[index];
    if (!land.crop) {
      return res.status(404).json({ error: "No crop found in this land" });
    }

    const oldStatus = land.crop.status || "";
    const oldPercentage = land.crop.statusPercentage || 0;

    // Update values
    land.crop.status = updateData.status || oldStatus;
    land.crop.statusPercentage = updateData.statusPercentage ?? oldPercentage;
    land.crop.updatedAt = admin.firestore.Timestamp.now();

    const newStatus = land.crop.status;
    const newPercentage = land.crop.statusPercentage;

    // Manage inventory if needed
    if (newStatus === "Harvesting" && oldStatus !== "Harvesting") {
      await manageInventory(farmerUid, land.crop, index, "add");
    } else if (
      oldStatus === "Harvesting" &&
      updateData.statusPercentage !== oldPercentage
    ) {
      await manageInventory(farmerUid, land.crop, index, "add");
    } else if (newStatus === "Field Clearing") {
      await manageInventory(farmerUid, land.crop, index, "remove");
    } else if (
      newStatus === "Harvested" &&
      newPercentage === 100 &&
      oldPercentage < 100
    ) {
      await manageInventory(farmerUid, land.crop, index, "remove");
    }

    await updateFarmerLands(farmerUid, lands);

    res.json({
      message: "Crop status updated successfully",
      crop: {
        landId,
        ...land.crop,
      },
    });
  } catch (err) {
    console.error("[updateCropByLandId] Error:", err);
    res.status(500).json({ error: err.message });
  }
}

//KEEP
async function createCropByLandId(req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const farmerUid = decodedToken.uid;

    const { landId, crop } = req.body;

    //console.log(`[createCropByLandId] Creating crop for farmerId: ${farmerId}, farmId: ${farmId}`);

    // Get current lands
    const lands = await getFarmerLandsByUid(farmerUid);

    if (!landId || typeof landId !== "string" || !landId.includes("-")) {
      return res.status(400).json({ error: "Invalid or missing landId" });
    }

    const landIndex = parseInt(landId.split("-")[1]); // ✅ FIXED HERE
    if (isNaN(landIndex) || landIndex < 0 || landIndex >= lands.length) {
      return res.status(404).json({ error: "Invalid landId" });
    }
    // Since farmId doesn't match landId, let's find land by name or use as index

    if (
      !crop.itemId ||
      typeof crop.itemId !== "string" ||
      crop.itemId.trim() === ""
    ) {
      return res.status(400).json({ error: "Invalid or missing itemId" });
    }

    // Check if item exists and get item details
    const itemDoc = await db.collection("items").doc(crop.itemId).get();
    if (!itemDoc.exists) {
      return res.status(400).json({ error: "Item not found" });
    }

    const itemData = itemDoc.data();
    //console.log(`[createCropByLandId] Item found: ${itemData.name}`);

    // Create crop data combining frontend fields + auto-generated fields
    const cropData = {
      // Frontend fields (use as-is)
      plantedAmount: crop.plantedAmount || 0,
      avgRatePerUnit: crop.avgRatePerUnit || 0,
      status: crop.status || "Planting",
      statusPercentage: crop.statusPercentage || 0,
      ExpectedFruitingPerPlant: crop.ExpectedFruitingPerPlant || 1.5, // Default to 1.5 if not provided
      expectedHarvestingKg: crop.expectedHarvestingKg,
      plantedDate: crop.plantedOn,
      expectedHarvestDate: crop.expectedHarvestDate,
      itemId: crop.itemId,
      imageUrl: crop.imageUrl,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };

    //console.log(`[createCropByLandId] Crop data prepared:`, cropData);

    // Update the specific land with crop data
    lands[landIndex].crop = cropData;

    // Save updated lands
    try {
      await updateFarmerLands(farmerUid, lands);
    } catch (saveError) {
      console.error(`🔧 DEBUG: updateFarmerLands failed:`, saveError);
      throw saveError;
    }

    //console.log(`[createCropByLandId] Successfully created crop in land ${landIndex}`);
    res.status(201).json({
      message: "Crop created successfully",
      crop: {
        id: `crop_${farmerUid}_${landIndex}`,
        landIndex: landIndex,
        landName: lands[landIndex].landName,
        ...cropData,
      },
    });
  } catch (err) {
    console.error("Error creating crop:", err);
    res.status(500).send({ error: err.message });
  }
}

async function approveShipmentRequest(req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const farmerUid = decodedToken.uid;

    const { requestId } = req.params;

    // Step 1: Get the shipment request document
    const requestRef = db.collection("shipmentRequests").doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({ error: "Shipment request not found" });
    }

    const requestData = requestDoc.data();

    // Check that the request belongs to the logged-in farmer
    if (requestData.farmerId !== farmerUid) {
      return res
        .status(403)
        .json({ error: "Unauthorized to approve this request" });
    }

    // Step 2: Update the request's status to "approved"
    await requestRef.update({
      status: "approved",
      approvedAt: admin.firestore.Timestamp.now(),
    });

    const shipmentId = requestId.replace("_SReq_", "_SH_");

    await db
      .collection("shipment")
      .doc(shipmentId)
      .set({
        ...requestData,
        driverId: null, // to be filled later
        origin: requestData.pickupAddress || null,
        destination: null, // e.g., warehouse name – unknown for now
        createdAt: admin.firestore.Timestamp.now(),
        overallStatus: "at-farm",
        problemFlag: false,
        shipmentRequestId: requestId,
        shipmentBarcode: null, // You can customize the format
        containerBarcodes: [],

        stages: [
          {
            key: "at-farm",
            label: "At Farm",
            timestamp: admin.firestore.Timestamp.now(),
            status: "ok",
          },
          {
            key: "ready-for-pickup",
            label: "Ready for Pickup",
            timestamp: admin.firestore.Timestamp.now(),
            status: "ok",
          },
          {
            key: "in-transit",
            label: "In Transit",
            timestamp: admin.firestore.Timestamp.now(),
            status: "ok",
          },
        ],

        fullReport: {
          shipmentId: shipmentId,
          status: "at-farm",
          farmerId: requestData.farmerId || null,
          amount: requestData.finalConfirmedQuantityKg
            ? `${requestData.finalConfirmedQuantityKg} kg`
            : null,
          pickupTime: new Date(`${requestData.scheduledPickupDate}`),
          driver: {
            name: null,
            phone: null,
            uid: null,
          },
          shipmentStatus: "In Transit (Driver en route)",
          farmerReports: [],
          logisticsResults: {},
          warehousePlacement: [],
          history: [
            {
              timestamp: admin.firestore.Timestamp.now(),
              user: "system",
              action: "Shipment record generated.",
            },
          ],
        },
      });

    res.status(200).json({
      message: "Shipment request approved and shipment created",
      shipmentId: shipmentId,
    });
  } catch (err) {
    console.error("[approveShipmentRequest] Error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function getCustomerOrderById(req, res) {
  try {
    const tokenUid = req.user.uid; // you got from auth middleware
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: "Missing orderId." });
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ error: "Order not found." });
    }

    const orderData = orderSnap.data();

    // Make sure the order belongs to this customer
    if (orderData.customerId !== tokenUid) {
      return res
        .status(403)
        .json({ error: "Not authorized to view this order." });
    }

    return res.status(200).json({ orderId, ...orderData });
  } catch (err) {
    console.error("Error fetching order:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}

// --- Export all functions ---
module.exports = {
  getShipmentRequests,
  getApprovedShipments,
  getApprovedShipmentsByID,
  getFarmerLands,
  getItemList,

  //old
  createCropByLandId,
  updateCropByLandId,
  deleteCropByLandId,

  getCustomerOrderById,
  approveShipmentRequest,
  submitShipmentReport,
};
