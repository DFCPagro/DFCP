const { admin, db } = require("../firebaseConfig");
const { DateTime } = require("luxon");
const { getUpcomingShiftsList } = require("../utils/shiftHelper");

// orders summary for shift -orders+ summarry by items, by farmer
async function getOrdersSummaryForShift(req, res) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token." });

    await admin.auth().verifyIdToken(token);

    const { shift, date } = req.query;
    if (!shift || !date)
      return res.status(400).json({ error: "Missing shift or date." });

    const prefix = `LC-1_ORD_${date}_${shift}`;
    console.log(`Fetching orders+summary for docId prefix: ${prefix}`);

    const ordersSnap = await db
      .collection("orders")
      .where(FieldPath.documentId(), ">=", prefix)
      .where(FieldPath.documentId(), "<", prefix + "\uf8ff")
      .get();

    const orders = [];
    const summaryMap = {};

    ordersSnap.forEach((doc) => {
      const data = doc.data();
      const docParts = doc.id.split("_");
      const randomNumber = docParts[docParts.length - 1];

      orders.push({
        orderNumber: randomNumber,
        ...data,
      });

      (data.items || []).forEach((item) => {
        if (!summaryMap[item.itemName]) {
          summaryMap[item.itemName] = { totalKg: 0, sources: {} };
        }
        summaryMap[item.itemName].totalKg += item.quantity;

        const farmerId = item.sourceFarmerId || "UNKNOWN_ID";
        const farmName = item.sourceFarmName || "UNKNOWN FARM";
        const farmerKey = `${farmerId}|${farmName}`;

        if (!summaryMap[item.itemName].sources[farmerKey]) {
          summaryMap[item.itemName].sources[farmerKey] = 0;
        }
        summaryMap[item.itemName].sources[farmerKey] += item.quantity;
      });
    });

    return res.json({ orders, summary: summaryMap });
  } catch (error) {
    console.error("Error loading orders+summary for shift:", error.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
}

const getDashboardStatus = async (req, res) => {
  try {
    const logisticCenterId = "LC-1";
    const upcomingShifts = await getUpcomingShiftsList(db, 8);

    const allShipReqsSnap = await db.collection("shipmentRequests").get();
    const allShipReqsIds = allShipReqsSnap.docs.map((doc) => doc.id);

    const shipmentSummary = [];
    const createStock = [];

    for (const { date, shift } of upcomingShifts) {
      const idPrefix = `${logisticCenterId}_SReq_${date}_${shift}`;

      // count how many shipment requests start with this prefix
      const matchingCount = allShipReqsIds.filter((id) =>
        id.startsWith(idPrefix)
      ).length;

      if (matchingCount > 0) {
        shipmentSummary.push({
          date: DateTime.fromISO(date.replace(/_/g, "-")).toFormat(
            "dd/MM/yyyy"
          ),
          shift,
          count: matchingCount,
        });
      } else {
        createStock.push({
          date: DateTime.fromISO(date.replace(/_/g, "-")).toFormat(
            "dd/MM/yyyy"
          ),
          shift,
        });
      }
    }

    return res.json({
      shipmentSummary,
      createStock,
    });
  } catch (err) {
    console.error("Error building shipment request summary:", err);
    return res.status(500).json({ error: "Failed to load data" });
  }
};

// GET demand statistics for a given shift
const getDemandStatistics = async (req, res) => {
  try {
    let { date, shift } = req.query; // e.g., date="2025/07/13" or "2025-07-13"

    if (!date || !shift) {
      console.warn("⚠️ Missing date or shift parameter in request.");
      return res.status(400).json({ error: "Missing date or shift param" });
    }

    // ✅ Normalize date to ISO format
    date = date.replace(/\//g, "-");

    console.log("🔍 Demand stats API called with date:", date, "shift:", shift);

    // Compute day of the week: e.g. "sunday"
    const dayOfWeek = DateTime.fromISO(date).toFormat("cccc").toLowerCase();

    // Create Firestore document ID: e.g. "sunday-morning"
    const docId = `${dayOfWeek}-${shift}`;
    console.log(`📄 Looking up demandStatistics/${docId}`);

    // Fetch from Firestore
    const docRef = db.collection("demandStatistics").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.warn(
        `❌ No document found for shift '${docId}' in demandStatistics.`
      );
      return res.status(404).json({ error: "No stats for this shift" });
    }

    const data = doc.data();
    console.log("✅ Found demand statistics:", data);

    return res.json({ items: data.items || [] });
  } catch (err) {
    console.error("❗ Error getting demand statistics:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// GET all farmer inventory for a specific itemId
// GET all farmer inventory entries for a specific itemId
const getFarmerInventory = async (req, res) => {
  try {
    const snapshot = await db.collection("farmerInventory").get();

    const results = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      results.push({
        farmerName: data.farmerName,
        farmerId: data.farmerId,
        itemId: data.itemId,
        currentAvailableForProcurementKg: data.currentAvailableForProcurementKg,
        maxOrder: data.maxOrder,
        status: data.status,
        pickupAddress: data.pickupAddress || "UNKNOWN ADDRESS",
        // add more fields if needed
      });
    });

    return res.json({ inventory: results });
  } catch (err) {
    console.error("Error fetching all inventory:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

const createStockItem = async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const {
      logisticCenterId,
      date, // e.g. "2025_07_13"
      shift, // e.g. "morning"
      items = [],
    } = req.body;

    if (!date || !date.match(/^\d{4}_\d{2}_\d{2}$/)) {
      throw new Error("Invalid or missing date format. Expected yyyy_mm_dd.");
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const createdbyID = decodedToken.uid;

    const userDoc = await db.collection("users").doc(createdbyID).get();
    if (!userDoc.exists) {
      console.warn(`User profile not found for UID: ${createdbyID}`);
      return res.status(400).json({ error: "User profile not found" });
    }

    const userData = userDoc.data();
    const createdByName = `${userData.firstName} ${userData.lastName}`;

    console.log(`📅 Using provided date for IDs: ${date}`);

    const stockDocId = `${logisticCenterId}_AS_${date}_${shift}`;
    const stockDocRef = db.collection("availableMarketStock").doc(stockDocId);
    const stockDoc = await stockDocRef.get();

    // Init stock data
    const today = new Date();
    const dateStr = date.replace(/_/g, "-");
    const stockData = stockDoc.exists
      ? stockDoc.data()
      : {
          logisticCenterId,
          availableDate: `${dateStr}T00:00:00Z`,
          availableShift: shift,
          generatedAt: today.toISOString(),
          createdByManagerId: createdbyID,
          items: [],
        };

    const createdShipmentIds = [];

    for (const item of items) {
      const {
        itemId,
        itemDisplayName,
        sourceFarmerId,
        sourceFarmName,
        pickupAddress,
        currentAvailableQuantityKg,
        originalCommittedQuantityKg,
      } = item;

      // 🔎 Lookup item price from items collection
      const itemDoc = await db.collection("items").doc(itemId).get();
      if (!itemDoc.exists) {
        console.warn(`⚠️ Item not found in catalog: ${itemId}`);
        continue;
      }

      const itemData = itemDoc.data();
      const basePrice = itemData.price?.a || 0;
      const finalPrice = parseFloat((basePrice * 1.2).toFixed(2));
      const itemImageUrl =
        itemData.imageUrl || "https://via.placeholder.com/100?text=No+Image";
      const category = itemData.category || "Unknown Category";

      const sourceFarmerDoc = await db
        .collection("users")
        .doc(sourceFarmerId)
        .get();
      if (!sourceFarmerDoc.exists) {
        console.warn(`User profile not found for UID: ${sourceFarmerId}`);
        continue;
      }
      const sourceFarmerData = sourceFarmerDoc.data();
      const sourceFarmerName = `${sourceFarmerData.firstName} ${sourceFarmerData.lastName}`;

      const farmerDoc = await db
        .collection("farmers")
        .doc(sourceFarmerId)
        .get();
      if (!farmerDoc.exists) {
        console.warn(`Farmer profile not found for UID: ${sourceFarmerId}`);
        continue;
      }
      const farmerData = farmerDoc.data();

      const stockItemId = `${itemId}_${sourceFarmerId}`;
      const sreqId = `${logisticCenterId}_SReq_${date}_${shift}_${sourceFarmerId}_${itemId}`;

      // Add stock item
      stockData.items.push({
        id: stockItemId,
        itemId,
        itemDisplayName,
        sourceFarmerId,
        sourceFarmerName,
        sourceFarmName: farmerData.extraFields?.farmName || sourceFarmName,
        pickupAddress,
        itemImageUrl,
        currentAvailableQuantityKg,
        originalCommittedQuantityKg,
        pricePerUnit: finalPrice,
        status: "active",
        shipReqId: sreqId,
        category,
      });

      // 🔥 Create shipmentRequest
      const shipmentRequest = {
        logisticCenterId,
        farmerManagerId: createdbyID,
        farmerManagerName: createdByName,
        farmerId: sourceFarmerId,
        farmerName: sourceFarmerName,
        pickupAddress,
        createdAt: today.toISOString(),
        scheduledPickupDate: `${dateStr}T00:00:00Z`,
        scheduledPickupTimeSlot: shift,
        status: "forecasted",
        itemId,
        itemDisplayName,
        forecastedQuantityKg: originalCommittedQuantityKg,
        finalConfirmedQuantityKg: null,
        expectedContainerCount: Math.ceil(originalCommittedQuantityKg / 20),
        exactAmountConfirmedAt: null,
        farmerLastNotifiedAt: null,
        lastUpdatedAt: today.toISOString(),
        createdbyID,
        createdByName,
        correspondingShipmentId: null,
      };

      await db
        .collection("farmerInventory")
        .doc(`${sourceFarmerId}_${itemId}`)
        .update({
          maxOrder: admin.firestore.FieldValue.increment(
            -originalCommittedQuantityKg
          ),
          currentAvailableForProcurementKg:
            admin.firestore.FieldValue.increment(-originalCommittedQuantityKg),
        });

      await db.collection("shipmentRequests").doc(sreqId).set(shipmentRequest);
      createdShipmentIds.push(sreqId);
    }

    // Save final stock data
    stockData.lastUpdatedAt = today.toISOString();
    stockData.createdbyID = createdbyID;
    stockData.createdByName = createdByName;

    await stockDocRef.set(stockData, { merge: true });

    res.status(200).json({
      message: "✅ Stock items and shipment requests saved.",
      stockId: stockDocId,
      shipmentRequestIds: createdShipmentIds,
    });
  } catch (err) {
    console.error("❌ Error creating stock items:", err);
    res.status(500).json({
      error: err.message || "failed to create stock items",
    });
  }
};

// GET /api/farmerManager/shipmentRequests?date=2025_07_13&shift=morning
const getShipmentRequestsForShift = async (req, res) => {
  try {
    const { date, shift } = req.query;

    if (!date || !shift) {
      return res
        .status(400)
        .json({ error: "Missing date or shift parameter." });
    }

    if (!date.match(/^\d{4}_\d{2}_\d{2}$/)) {
      return res
        .status(400)
        .json({ error: "Invalid date format. Use yyyy_mm_dd." });
    }

    console.log(`📦 Loading shipment requests for date=${date} shift=${shift}`);

    // 🔥 Build stock document ID
    const stockDocId = `LC-1_AS_${date}_${shift}`;
    console.log(`Looking up stock document: ${stockDocId}`);

    const stockDoc = await db
      .collection("availableMarketStock")
      .doc(stockDocId)
      .get();
    const stockItems =
      stockDoc.exists && stockDoc.data().items ? stockDoc.data().items : [];

    // 🔍 Load all shipmentRequests with status != finalized
    const snapshot = await db
      .collection("shipmentRequests")
      .where("status", "!=", "finalized")
      .get();

    console.log(`Loaded ${snapshot.size} shipment requests.`);

    // 🔍 Filter by ID parts
    const [yyyy, mm, dd] = date.split("_");

    const filtered = snapshot.docs
      .filter((doc) => {
        const parts = doc.id.split("_");
        return (
          parts[0] === "LC-1" &&
          parts[1] === "SReq" &&
          parts[2] === yyyy &&
          parts[3] === mm &&
          parts[4] === dd &&
          parts[5] === shift
        );
      })
      .map((doc) => {
        const data = doc.data();
        console.log(`Found shipmentRequest ${doc.id}`);

        const matchingItem = stockItems.find(
          (item) =>
            item.itemId === data.itemId && item.sourceFarmerId === data.farmerId
        );

        const committedOrders = matchingItem
          ? matchingItem.originalCommittedQuantityKg -
            matchingItem.currentAvailableQuantityKg
          : 0;

        return {
          id: doc.id,
          ...data,
          committedOrders,
        };
      });

    console.log(`Prepared ${filtered.length} shipment requests.`);

    res.status(200).json(filtered);
  } catch (err) {
    console.error("Error in getShipmentRequestsForShift:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// POST /api/farmerManager/finalizeShipmentRequest
const shipmentRequestQuantitiesConfirmed = async (req, res) => {
  try {
    const { shipmentRequestId, finalConfirmedQuantityKg } = req.body;

    if (!shipmentRequestId || finalConfirmedQuantityKg == null) {
      return res.status(400).json({ error: "Missing data in request body" });
    }

    const sreqRef = db.collection("shipmentRequests").doc(shipmentRequestId);
    const sreqSnap = await sreqRef.get();

    if (!sreqSnap.exists) {
      return res.status(404).json({ error: "Shipment request not found" });
    }

    // 🔥 Now update farmer inventory maxOrder
    const farmerInventoryId = `${sreqRef.farmerId}_${sreqRef.itemId}`;
    const farmerInventoryRef = db
      .collection("farmerInventory")
      .doc(farmerInventoryId);
    const farmerInventorySnap = await farmerInventoryRef.get();

    if (farmerInventorySnap.exists) {
      const farmerData = farmerInventorySnap.data();
      const updatedMaxOrder = (
        parseFloat(farmerData.maxOrder || 0) +
        shipmentRequest.forecastedQuantityKg -
        finalConfirmedQuantityKg
      ).toFixed(2);
      const updateAVailableForProcurementKg = (
        parseFloat(farmerData.currentAvailableForProcurementKg || 0) +
        shipmentRequest.forecastedQuantityKg -
        finalConfirmedQuantityKg
      ).toFixed(2);

      await farmerInventoryRef.update({
        maxOrder: parseFloat(updatedMaxOrder),
        currentAvailableForProcurementKg: parseFloat(
          updateAVailableForProcurementKg
        ),
      });
    }

    const now = new Date();
    const shipmentRequest = sreqSnap.data();

    // Update shipment request
    await sreqRef.update({
      finalConfirmedQuantityKg,
      status: "finalized",
      exactAmountConfirmedAt: now.toISOString(),
    });

    // res.status(200).json({ message: "Shipment request finalized", shipmentId });
    res.status(200).json({ message: "Shipment request updated" });
  } catch (error) {
    console.error("Error finalizing shipment request:", error);
    res.status(500).json({ error: "Failed to finalize shipment request" });
  }
};

const getApplication = async (req, res) => {
  try {
    const snapshot = await db.collection("employmentApplications").get();
    const results = [];

    for (const doc of snapshot.docs) {
      const uid = doc.id;
      const applicationData = doc.data();

      // Only allow 'pending' or 'contacted' statuses
      if (
        applicationData.status !== "pending" &&
        applicationData.status !== "contacted"
      ) {
        continue;
      }

      if (applicationData.role !== "farmer") {
        continue;
      }

      // Get the user profile using the same UID
      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        console.warn(`User profile not found for UID: ${uid}`);
        continue;
      }

      const userData = userDoc.data();
      results.push({
        uid: uid,
        role: applicationData.role,
        status: applicationData.status,
        submittedAt: applicationData.submittedAt,
        extraFields: applicationData.extraFields,

        // Append user profile fields
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phone: userData.phone,
        address: userData.address,
        birthDate: userData.birthDate,
      });
    }

    res.send(results);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).send({ error: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const snapshot = await db.collection("farmers").get();
    const results = [];

    for (const doc of snapshot.docs) {
      const uid = doc.id;
      const farmerData = doc.data();

      // Get the user profile using the same UID
      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        console.warn(`User profile not found for UID: ${uid}`);
        continue;
      }

      const userData = userDoc.data();
      results.push({
        uid: uid,
        extraFields: farmerData.extraFields || {}, // Include any extra fields from farmer data
        // Append user profile fields
        firstName: userData.firstName,
        role: userData.role,
        lastName: userData.lastName,
        email: userData.email,
        phone: userData.phone,
        address: userData.address,
        birthDate: userData.birthDate,
      });
    }

    res.send(results);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

// PUT /api/farmerManager/updateAggrement/:uid
const updateAggrementPrecentage = async (req, res) => {
  const { uid } = req.params;
  const { agreementPercentage } = req.body;

  if (!uid || agreementPercentage == null) {
    return res
      .status(400)
      .json({ error: "Missing uid or agreementPercentage in request" });
  }

  try {
    const farmerRef = db.collection("farmers").doc(uid);
    const doc = await farmerRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Farmer not found" });
    }

    await farmerRef.update({
      "extraFields.agreementPercentage": agreementPercentage,
    });

    return res.status(200).json({ message: "Agreement percentage updated" });
  } catch (error) {
    console.error("Error updating agreementPercentage:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

async function updateApplicationStatus(req, res) {
  const uid = req.params.uid;
  const { status, role, firstName, lastName, phone } = req.body;

  if (!uid || !status) {
    return res.status(400).send({ error: "Missing UID or status" });
  }

  const validStatuses = ["pending", "contacted", "denied", "approved"];
  if (!validStatuses.includes(status)) {
    return res.status(400).send({ error: `Invalid status: ${status}` });
  }

  const appRef = db.collection("employmentApplications").doc(uid);

  try {
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
      return res.status(404).send({ error: "Application not found" });
    }

    const appData = appSnap.data();

    // If status is approved, do the full approval process
    if (status === "approved") {
      // 1. Copy to the role-specific collection
      await db
        .collection("farmers")
        .doc(uid)
        .set({
          //add name and phone number
          ...appData,
          firstName,
          lastName,
          phone,
          approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      // 2. Update user's main role
      await db.collection("users").doc(uid).set(
        {
          role,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    // For all statuses (including "approved"), update the application status
    await appRef.update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.send({ message: `Application marked as ${status}` });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).send({ error: error.message });
  }
}

// GET all items for farmer manager with all details
const getAllItems = async (req, res) => {
  try {
    const snapshot = await db.collection("items").get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json(items);
  } catch (err) {
    console.error("Error getting items:", err);
    return res.status(500).json({ error: "Failed to load items" });
  }
};

// ADD new item
const addNewItem = async (req, res) => {
  try {
    const data = req.body;
    const ref = await db.collection("items").add({
      ...data,
      lastUpdated: new Date().toISOString(),
    });
    return res.json({ id: ref.id });
  } catch (err) {
    console.error("Error adding item:", err);
    return res.status(500).json({ error: "Failed to add item" });
  }
};

// EDIT existing item
const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    await db
      .collection("items")
      .doc(id)
      .update({
        ...req.body,
        lastUpdated: new Date().toISOString(),
      });
    return res.json({ success: true });
  } catch (err) {
    console.error("Error updating item:", err);
    return res.status(500).json({ error: "Failed to update item" });
  }
};

const deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    if (!itemId) {
      return res.status(400).json({ error: "Missing item ID" });
    }

    await db.collection("items").doc(itemId).delete();

    return res.json({ success: true, message: "Item deleted successfully." });
  } catch (err) {
    console.error("Failed to delete item:", err);
    return res.status(500).json({ error: "Could not delete item" });
  }
};

module.exports = {
  updateApplicationStatus,
  getAllUsers,
  getApplication,
  getShipmentRequestsForShift,
  updateAggrementPrecentage,
  shipmentRequestQuantitiesConfirmed,
  getDemandStatistics,
  getFarmerInventory,
  createStockItem,
  getDashboardStatus,
  getAllItems,
  addNewItem,
  updateItem,
  deleteItem,
  getOrdersSummaryForShift,
};
