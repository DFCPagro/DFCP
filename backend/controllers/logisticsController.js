// logisticsController.js

const { db, admin } = require("../firebaseConfig");

// Shipment management

async function listIncomingShipments(req, res) {
  try {
    const snapshot = await db
      .collection("shipments")
      .where("status", "in", ["scheduled", "in_transit", "assigned"])
      .get();
    const shipments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json({ shipments });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

async function getShipmentDetails(req, res) {
  try {
    const { shipmentId } = req.params;
    const doc = await db.collection("shipments").doc(shipmentId).get();
    if (!doc.exists)
      return res.status(404).send({ error: "Shipment not found" });
    res.json({ shipment: { id: doc.id, ...doc.data() } });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

async function receiveShipment(req, res) {
  try {
    const { shipmentId } = req.params;
    await db.collection("shipments").doc(shipmentId).update({
      status: "received",
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ message: "Shipment received" });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

async function assignDriver(req, res) {
  try {
    const { shipmentId } = req.params;
    const { driver } = req.body;
    await db.collection("shipments").doc(shipmentId).update({
      driver,
      status: "assigned",
      assignedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ message: "Driver assigned" });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

async function updateShipmentStatus(req, res) {
  try {
    const { shipmentId } = req.params;
    const { status } = req.body;
    await db.collection("shipments").doc(shipmentId).update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ message: "Shipment status updated" });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

// Picklist management

async function listOpenPicklists(req, res) {
  try {
    const snapshot = await db
      .collection("picklists")
      .where("status", "==", "open")
      .get();
    const picklists = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json({ picklists });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

async function getPicklist(req, res) {
  try {
    const { picklistId } = req.params;
    const doc = await db.collection("picklists").doc(picklistId).get();
    if (!doc.exists)
      return res.status(404).send({ error: "Picklist not found" });
    res.json({ picklist: { id: doc.id, ...doc.data() } });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

async function updatePickItem(req, res) {
  try {
    const { picklistId, itemId } = req.params;
    const { pickedQuantity, status } = req.body;
    const update = {
      [`items.${itemId}.pickedQuantity`]: pickedQuantity,
      [`items.${itemId}.status`]: status,
      [`items.${itemId}.updatedAt`]:
        admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection("picklists").doc(picklistId).update(update);
    res.json({ message: "Picklist item updated" });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

async function completePicklist(req, res) {
  try {
    const { picklistId } = req.params;
    await db.collection("picklists").doc(picklistId).update({
      status: "completed",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ message: "Picklist completed" });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}

module.exports = {
  listIncomingShipments,
  getShipmentDetails,
  receiveShipment,
  assignDriver,
  updateShipmentStatus,
  listOpenPicklists,
  getPicklist,
  updatePickItem,
  completePicklist,
};
