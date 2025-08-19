const { DateTime } = require("luxon");
const { admin, db } = require("../firebaseConfig");


async function getAvailableShifts(req, res) {
  try {
    const shiftsConfig = {
      morning: { start: "01:00", end: "07:00" },
      afternoon: { start: "07:00", end: "13:00" },
      evening: { start: "13:00", end: "19:00" },
      night: { start: "19:00", end: "01:00" }
    };

    const now = DateTime.now().setZone("Asia/Jerusalem");
    const availableShifts = [];

    for (let i = 0; i < 2; i++) {
      const day = now.plus({ days: i }).startOf("day");

      for (const [shiftName, times] of Object.entries(shiftsConfig)) {
        let shiftStart = DateTime.fromFormat(times.start, "HH:mm", { zone: "Asia/Jerusalem" });
        let shiftEnd = DateTime.fromFormat(times.end, "HH:mm", { zone: "Asia/Jerusalem" });

        if (shiftName !== "night") {
          shiftStart = shiftStart.set({ year: day.year, month: day.month, day: day.day });
          shiftEnd = shiftEnd.set({ year: day.year, month: day.month, day: day.day });
        } else {
          shiftStart = shiftStart.set({ year: day.year, month: day.month, day: day.day });
          shiftEnd = shiftEnd.plus({ days: 1 }).set({ year: day.plus({ days:1 }).year, month: day.plus({ days:1 }).month, day: day.plus({ days:1 }).day });
        }

        if (shiftStart > now) {
          // Check Firestore if this stock exists
          const stockId = `LC-1_AS_${day.toFormat("yyyy_MM_dd")}_${shiftName}`;
          const stockDoc = await db.collection("availableMarketStock").doc(stockId).get();

          if (stockDoc.exists) {
            const deliveryTime = shiftEnd.minus({ hours: 1 }).toFormat("HH:mm") + "-" + shiftEnd.toFormat("HH:mm");
            availableShifts.push({
              id: stockId, // now we return the actual stock id
              label: `${day.toFormat("cccc")} ${shiftName} (Delivery: ${deliveryTime})`
            });
          }
        }
      }
    }

    res.json(availableShifts);
  } catch (err) {
    console.error("Error fetching dynamic shifts:", err);
    res.status(500).json({ error: "Failed to load available shifts" });
  }
};

async function getAvailableStock(req, res) {
  try {
    const stockId = req.params.stockId;
    //console.log("Looking for stock document with ID:", stockId);

    const stockDoc = await db.collection("availableMarketStock").doc(stockId).get();
    //console.log("CHECKING ID EXACT MATCH:", stockId, "-> exists:", stockDoc.exists);

    if (!stockDoc.exists) {
      //console.log("Document not found in Firestore.");
      return res.status(404).json({ error: "Stock not found for this shift." });
    }

    const stockData = stockDoc.data();
    //console.log("Firestore data:", stockData);

    res.json(stockData.items || []);
  } catch (err) {
    //console.error("Error fetching available stock:", err);
    res.status(500).json({ error: "Failed to load available stock." });
  }

}

async function getItemList(req, res) {
 try {
    const snapshot = await db.collection("items").get();
    const itemList = snapshot.docs.map(doc => ({
      itemId: doc.data().itemId,
      name: doc.data().name,
      category: doc.data().category
    }));
    res.json(itemList);
  } catch (err) {
    console.error("Error fetching item list:", err);
    res.status(500).json({ error: "Failed to load item list." });
  }
}

async function reserveItem(req, res) {
  try {
    const { stockId, itemId, sourceFarmerId, quantity } = req.body;
    const itemKey = `${itemId}_${sourceFarmerId}`;
    const stockRef = db.collection("availableMarketStock").doc(stockId);

    await db.runTransaction(async (t) => {
      const stockDoc = await t.get(stockRef);
      if (!stockDoc.exists) throw new Error("Stock document not found.");

      const data = stockDoc.data();
      const updatedItems = data.items.map(item => {
        if (item.id === itemKey) {
          if (item.currentAvailableQuantityKg < quantity) {
            throw new Error(`Only ${item.currentAvailableQuantityKg} kg left in stock.`);
          }
          return { ...item, currentAvailableQuantityKg: item.currentAvailableQuantityKg - quantity };
        }
        return item;
      });

      t.update(stockRef, { items: updatedItems });
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Reserve item failed:", err);
    res.status(400).json({ error: err.message || "Failed to reserve item." });
  }
}


async function restoreItem(req, res) {
  try {
    const { stockId, itemId, sourceFarmerId, quantity } = req.body;
    const itemKey = `${itemId}_${sourceFarmerId}`;
    const stockRef = db.collection("availableMarketStock").doc(stockId);

    await db.runTransaction(async (t) => {
      const stockDoc = await t.get(stockRef);
      if (!stockDoc.exists) throw new Error("Stock document not found.");

      const data = stockDoc.data();
      const updatedItems = data.items.map(item => {
        if (item.id === itemKey) {
          return {
            ...item,
            currentAvailableQuantityKg: item.currentAvailableQuantityKg + quantity
          };
        }
        return item;
      });

      t.update(stockRef, { items: updatedItems });
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Restore item failed:", err);
    res.status(400).json({ error: err.message || "Failed to restore item." });
  }
}
async function submitOrder(req, res) {
  try {
    const { uid } = req.user; // from auth middleware
    const {
      items,               // list of items from cart
      deliveryAddress,     // map: street, city, lat, lng, label
      deliveryDate,        // string (ISO) e.g. "2025-07-15T00:00:00Z"
      deliveryShift,       // "morning", etc
      totalOrderValue,     // monetary value
      totalOrderWeightKg,   // total weight
      stockId,
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: "No items in order." });
    }

    // === Generate unique order ID ===
  
   const originalString = stockId;
const parts = originalString.split("_");
const date = `${parts[2]}_${parts[3]}_${parts[4]}`;
const shift = parts[5]; // "morning"
const rand = Math.floor(Math.random() * 10000);
const orderId = `LC-1_ORD_${date}_${deliveryShift}_${uid}_${rand}`;
//console.log(orderId);

    // === Prepare clean delivery timestamp ===
    const deliveryDateObj = deliveryDate ? new Date(deliveryDate) : new Date();

    const deliveryDateTimestamp = admin.firestore.Timestamp.fromDate(deliveryDateObj);

    // === Build order data ===
    const orderData = {
      customerId: uid,
      logisticCenterId: "LC-1",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "pending",
      deliveryAddress: deliveryAddress || {},
      deliveryDate: deliveryDateTimestamp,
      deliveryShift: deliveryShift || "unknown",
      totalOrderValue: totalOrderValue || 0,
      totalOrderWeightKg: totalOrderWeightKg || 0,
      assignedDelivererId: null,
      delivererAssignedAt: null,
      readyForPickupAt: null,
      delivererPickupLocation: "self 4c",
      pickedUpByDelivererAt: null,
      deliveredAt: null,
      delivererTaskRef: null,
      items
    };
   // console.log(orderData);

    // === Save order to orders collection ===
    await db.collection("orders").doc(orderId).set(orderData);

    // === Link order ID to customer's document ===
    const customerRef = db.collection("customers").doc(uid);
    await customerRef.set(
      {
        orders: admin.firestore.FieldValue.arrayUnion(orderId)
      },
      { merge: true }
    );

    console.log(`✅ Created order ${orderId} for customer ${uid}`);
    res.json({ success: true, orderId });

  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ error: "Failed to create order." });
  }
}




module.exports = {
 getAvailableStock,
  getAvailableShifts,
  getItemList,reserveItem,
  restoreItem,
  submitOrder,
};
