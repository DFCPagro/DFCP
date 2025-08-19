const { admin, db } = require("../firebaseConfig");
const { DateTime } = require("luxon");
const { getUpcomingShiftsList } = require("../utils/shiftHelper");
const { FieldPath } = require("firebase-admin/firestore");

function parseTimeStr(timeStr) {
  const [hour, minute] = timeStr.split(":").map(Number);
  return { hour, minute };
}


async function getAllOrdersForShifts(req, res) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided." });

    await admin.auth().verifyIdToken(token);

    const upcomingShifts = await getUpcomingShiftsList(db, 6);
    console.log(upcomingShifts);

    const results = [];
    for (const entry of upcomingShifts) {
      const prefix = `LC-1_ORD_${entry.date}_${entry.shift}`;
      //console.log(`Counting orders for: ${prefix}`);

      const ordersSnap = await db
        .collection("orders")
        .where(FieldPath.documentId(), ">=", prefix)
        .where(FieldPath.documentId(), "<", prefix + "\uf8ff")
        .get();

      results.push({
        shift: `${entry.date.replace(/_/g, "-")} ${capitalizeWords(entry.shift)}`,
        orders: ordersSnap.size
      });
    }

    console.log("Returning shifts summary:", results);
    return res.json(results);

  } catch (err) {
    //console.error("Error fetching orders for shifts:", err.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
}

function capitalizeWords(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

async function getOrdersForShift(req, res) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided." });

    await admin.auth().verifyIdToken(token);

    const { date, shift } = req.query;
    if (!date || !shift) {
      return res.status(400).json({ error: "Missing date or shift in query." });
    }

    const prefix = `LC-1_ORD_${date.replace(/-/g, "_")}_${shift}`;
    //console.log(`Looking up orders with prefix: ${prefix}`);

    const ordersSnap = await db.collection("orders")
      .where(FieldPath.documentId(), ">=", prefix)
      .where(FieldPath.documentId(), "<", prefix + "\uf8ff")
      .get();

    const orders = ordersSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        data,
        
      };
    });

   // console.log(`Found ${orders.length} orders for ${date} ${shift}`);
    return res.json(orders);

  } catch (err) {
    //console.error("Error fetching orders for shift:", err.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// orders summary for shift -orders+ summarry by items, by farmer
async function getOrdersWithSummaryForShift(req, res) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token." });

    await admin.auth().verifyIdToken(token);

    const { shift, date } = req.query;
    if (!shift || !date)
      return res.status(400).json({ error: "Missing shift or date." });

    const prefix = `LC-1_ORD_${date}_${shift}`;
   // console.log(`Fetching orders+summary for docId prefix: ${prefix}`);

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
   // console.error("Error loading orders+summary for shift:", error.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function getOrdersForUpcomingShifts(req, res) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided." });

    await admin.auth().verifyIdToken(token);

    // Load shifts
    const shiftsSnap = await db.collection("shifts").get();
    if (shiftsSnap.empty)
      return res.status(404).json({ error: "No shifts defined." });

    let shifts = [];
    shiftsSnap.forEach((doc) => {
      const data = doc.data();
      shifts.push({
        name: doc.id.toLowerCase(),
        start: data.start,
        end: data.end,
      });
    });

    shifts.sort((a, b) => {
      const timeA =
        parseTimeStr(a.start).hour * 60 + parseTimeStr(a.start).minute;
      const timeB =
        parseTimeStr(b.start).hour * 60 + parseTimeStr(b.start).minute;
      return timeA - timeB;
    });

    const now = DateTime.local();
    const upcomingShifts = [];
    let dayCursor = now;

    while (upcomingShifts.length < 6) {
      const dateStr = dayCursor.toISODate().replace(/-/g, "_");

      for (const shift of shifts) {
        const { hour: startHour, minute: startMinute } = parseTimeStr(
          shift.start
        );
        const { hour: endHour, minute: endMinute } = parseTimeStr(shift.end);

        let shiftStartTime = dayCursor.set({
          hour: startHour,
          minute: startMinute,
          second: 0,
          millisecond: 0,
        });

        let shiftEndTime = dayCursor.set({
          hour: endHour,
          minute: endMinute,
          second: 0,
          millisecond: 0,
        });

        // Handle night shifts that end after midnight
        if (
          endHour < startHour ||
          (endHour === startHour && endMinute < startMinute)
        ) {
          shiftEndTime = shiftEndTime.plus({ days: 1 });
        }

        if (shiftEndTime > now) {
          upcomingShifts.push({ date: dateStr, shift: shift.name });
          if (upcomingShifts.length === 6) break;
        }
      }

      dayCursor = dayCursor.plus({ days: 1 });
    }

    // Now for each shift, count matching orders by docId prefix
    const results = [];
    for (const entry of upcomingShifts) {
      const prefix = `LC-1_ORD_${entry.date}_${entry.shift}`;
     // console.log(`Counting orders for: ${prefix}`);

      const ordersSnap = await db
        .collection("orders")
        .where(FieldPath.documentId(), ">=", prefix)
        .where(FieldPath.documentId(), "<", prefix + "\uf8ff")
        .get();

      console.log(
        `Found ${ordersSnap.size} orders for ${entry.shift} on ${entry.date}`
      );

      results.push({
        shift: entry.shift,
        date: entry.date,
        totalOrders: ordersSnap.size,
      });
    }

    return res.json(results);
  } catch (error) {
    console.error("Error fetching upcoming orders by shift:", error.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
}



/*===FOR DELIVERY SUMMARRY TO FARMER=*/





async function getOrdersGroupedByFarmerForShift(req, res) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token." });

    await admin.auth().verifyIdToken(token);

    const { shift, date } = req.query;
    if (!shift || !date)
      return res.status(400).json({ error: "Missing shift or date." });

    const prefix = `LC-1_ORD_${date}_${shift}`;
    const ordersSnap = await db.collection("orders")
      .where(FieldPath.documentId(), ">=", prefix)
      .where(FieldPath.documentId(), "<", prefix + "\uf8ff")
      .get();

    const orders = [];
    const farmerSummary = {};

    ordersSnap.forEach((doc) => {
      const data = doc.data();
      const docParts = doc.id.split("_");
      const randomNumber = docParts[docParts.length - 1];
      orders.push({ orderNumber: randomNumber, ...data });

      (data.items || []).forEach((item) => {
        const farmerId = item.sourceFarmerId || "UNKNOWN_ID";
        const farmName = item.sourceFarmName || "UNKNOWN FARM";

        if (!farmerSummary[farmerId]) {
          farmerSummary[farmerId] = {
            totalKg: 0,
            items: [],
            farmNames: new Set(),
          };
        }

        farmerSummary[farmerId].totalKg += item.quantity;
        farmerSummary[farmerId].items.push({
          itemName: item.itemName,
          quantity: item.quantity,
          farmName,
          shipReqId: item.shipReqId,
          itemImageUrl: item.itemImageUrl
        });
        farmerSummary[farmerId].farmNames.add(farmName);
      });
    });

    // load farmer pickup details
    const farmerIds = Object.keys(farmerSummary).filter(id => id !== "UNKNOWN_ID");
    let pickupDetails = {};
    if (farmerIds.length > 0) {
      const farmerRefs = farmerIds.map(id => db.collection("farmers").doc(id));
      const farmerDocs = await db.getAll(...farmerRefs);
      farmerDocs.forEach((doc) => {
        if (doc.exists) {
          const data = doc.data();
          pickupDetails[doc.id] = {
            address: data.pickupAddress || "No Address",
            lat: data.pickupLat || null,
            lng: data.pickupLng || null
          };
        }
      });
    }

    const finalSummary = await Promise.all(
      Object.entries(farmerSummary).map(async ([farmerId, summary]) => {
        let pickup = pickupDetails[farmerId] || { address: "No Address", lat: null, lng: null };
        if (!pickup.lat || !pickup.lng) {
          pickup = await findFullAddress(farmerId);
        }
        return {
          farmerId,
          pickupAddress: pickup.address,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          totalKg: summary.totalKg,
          farms: Array.from(summary.farmNames),
          items: summary.items
        };
      })
    );

    return res.json({ orders, farmerSummary: finalSummary });

  } catch (err) {
    console.error("Error in getOrdersGroupedByFarmerForShift:", err.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function findFullAddress(farmerId) {
  try {
    const farmerDoc = await db.collection("farmers").doc(farmerId).get();
    if (!farmerDoc.exists) {
      return { address: "No Address", lat: null, lng: null };
    }
    const data = farmerDoc.data();

    // Try primary pickup location
    if (data.pickupLat && data.pickupLng) {
      return {
        address: data.pickupAddress || "No Address",
        lat: data.pickupLat,
        lng: data.pickupLng
      };
    }

    // Try to fallback from lands
    const lands = data.lands || [];
    if (lands.length > 0) {
      let totalLat = 0;
      let totalLng = 0;
      let count = 0;

      lands.forEach(land => {
        const lat = parseFloat(land.pickupLat);
        const lng = parseFloat(land.pickupLng);
        if (!isNaN(lat) && !isNaN(lng)) {
          totalLat += lat;
          totalLng += lng;
          count++;
        }
      });

      if (count > 0) {
        const avgLat = totalLat / count;
        const avgLng = totalLng / count;
        return {
          address: "Based on farm lands",
          lat: avgLat,
          lng: avgLng
        };
      }
    }

    // Still nothing
    return { address: "No Address", lat: null, lng: null };
  } catch (err) {
    console.error("Error fetching fallback address for farmer:", farmerId, err);
    return { address: "No Address", lat: null, lng: null };
  }
}




module.exports={
  getAllOrdersForShifts,
  getOrdersForShift,
  getOrdersWithSummaryForShift,
  getOrdersForUpcomingShifts,
  getOrdersGroupedByFarmerForShift,

}