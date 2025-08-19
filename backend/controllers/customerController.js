// customerController.js

const { DateTime } = require("luxon");
const { admin, db } = require("../firebaseConfig");

// === markOrderAsDelivered ===
async function markOrderAsDelivered(req, res) {
  try {
    const { orderId } = req.params;
    const { uid } = req.user;

    if (!orderId) {
      return res.status(400).json({ error: "Missing orderId." });
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ error: "Order not found." });
    }

    const orderData = orderSnap.data();

    // 🔐 Ensure this customer owns the order
    if (orderData.customerId !== uid) {
      return res.status(403).json({ error: "You do not have permission to modify this order." });
    }

    await orderRef.update({
      status: "delivered",
      deliveredAt: DateTime.now().toISO(),
    });

    return res.json({ message: `Order ${orderId} marked as delivered.` });
  } catch (err) {
    console.error("Error updating order status:", err);
    return res.status(500).json({ error: "Failed to update order status." });
  }
}




// getSavedAddresses ===
async function getSavedAddress(req, res) {
  try {
    const { uid } = req.user;

    const customerRef = db.collection("customers").doc(uid);
    let customerSnap = await customerRef.get();

    if (!customerSnap.exists) {
      await ensureCustomerExists(uid);
      // refetch after creation
      customerSnap = await customerRef.get();
    }

    const data = customerSnap.data();
    const addresses = data.addresses || [];

    return res.json({ addresses });
  } catch (err) {
    console.error("Error fetching customer addresses:", err);
    return res.status(500).json({ error: "Failed to load addresses." });
  }
}


async function getCustomerOrders(req, res) {
  try {
    const { uid } = req.user;
    const customerSnap = await db.collection("customers").doc(uid).get();

    if (!customerSnap.exists) {
      return res.json([]);
    }

    const customerData = customerSnap.data();
    const orderIds = customerData.orders || [];

    if (!orderIds.length) {
      return res.json([]);
    }

    const orderDocs = await Promise.all(orderIds.map(id => db.collection("orders").doc(id).get()));
    const orders = orderDocs
      .filter(doc => doc.exists)
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          deliveryDate: data.deliveryDate?.toDate().toISOString() || null
        };
      });

    res.json(orders);
  } catch (err) {
    console.error("Failed to fetch customer orders:", err);
    res.status(500).json({ error: "Failed to load orders." });
  }
}

async function getCustomerOrderById(req, res) {
  try {
    const tokenUid = req.user.uid; // from auth middleware
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: "Missing orderId." });
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ error: "Order not found." });
    }

    const data = orderSnap.data();

    if (data.customerId !== tokenUid) {
      return res.status(403).json({ error: "Not authorized to view this order." });
    }

    return res.status(200).json({
      orderId,
      ...data,
      deliveryAddress: data.deliveryAddress || null,
      deliveryDate: data.deliveryDate ? data.deliveryDate.toDate().toISOString().split("T")[0] : null
    });

  } catch (err) {
    console.error("Error fetching order:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}






// =================== PROFILE ===================
async function getCustomerProfile(req, res) {
  try {
    const doc = await db.collection("users").doc(req.user.uid).get();
    if (!doc.exists) return res.status(404).send({ error: "User not found" });
    res.json({ profile: doc.data() });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

async function updateCustomerProfile(req, res) {
  try {
    const updates = req.body;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("users").doc(req.user.uid).update(updates);
    res.json({ message: "Profile updated" });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

const addNewAddress = async (req, res) => {
  try {
    const { uid } = req.user;
    const { address, latitude, longitude } = req.body;

    if (!address || latitude == null || longitude == null) {
      return res.status(400).json({ error: "Missing address data." });
    }

    // 🔥 Ensure customer doc exists first
    await ensureCustomerExists(uid);

    const customerRef = db.collection("customers").doc(uid);
    const customerSnap = await customerRef.get();
    const customerData = customerSnap.data();

    const existing = (customerData.addresses || []).find(
      (a) => a.address === address
    );

    if (existing) {
      return res.json({ message: "Address already exists." });
    }

    await customerRef.update({
      addresses: [...(customerData.addresses || []), { address, latitude, longitude }]
    });

    return res.json({ message: "Address saved." });
  } catch (err) {
    console.error("Error saving address:", err);
    return res.status(500).json({ error: "Failed to save address." });
  }
};


async function ensureCustomerExists(uid) {
  const customerRef = db.collection("customers").doc(uid);
  const customerSnap = await customerRef.get();

  if (!customerSnap.exists) {
    await customerRef.set({
      createdAt: new Date().toISOString(),
      addresses: []
    });
    console.log(`✅ Created new customer doc for uid ${uid}`);
  }
}







module.exports = {
 addNewAddress,
  getSavedAddress,
  getCustomerProfile,
  getCustomerOrders,
  getCustomerOrderById,
  markOrderAsDelivered,
};
