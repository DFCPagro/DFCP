const { admin, db } = require("../firebaseConfig");
const { DateTime } = require("luxon");
const { FieldPath } = require("firebase-admin").firestore;
const { getUpcomingShiftsList } = require("../utils/shiftHelper");

async function exampleController(req, res) {
  try {
    const upcomingShifts = await getUpcomingShiftsList(db, 6);
    console.log("Upcoming shifts:", upcomingShifts);
    return res.json(upcomingShifts);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}

function parseTimeStr(timeStr) {
  const [hour, minute] = timeStr.split(":").map(Number);
  return { hour, minute };
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
      console.log(`Counting orders for: ${prefix}`);

      const ordersSnap = await db
        .collection("orders")
        .where(FieldPath.documentId(), ">=", prefix)
        .where(FieldPath.documentId(), "<", prefix + "\uf8ff")
        .get();

      //console.log(
      //  `Found ${ordersSnap.size} orders for ${entry.shift} on ${entry.date}`
      //);

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

//gets all orders made for the shift
async function getOrdersForShift(req, res) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token." });

    await admin.auth().verifyIdToken(token);

    const { shift, date } = req.query;
    if (!shift || !date)
      return res.status(400).json({ error: "Missing shift or date." });

    const prefix = `LC-1_ORD_${date}_${shift}`;
    console.log(`Fetching orders for docId prefix: ${prefix}`);

    const ordersSnap = await db
      .collection("orders")
      .where(FieldPath.documentId(), ">=", prefix)
      .where(FieldPath.documentId(), "<", prefix + "\uf8ff")
      .get();

    const orders = [];
    ordersSnap.forEach((doc) => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        customerId: data.customerId,
        status: data.status,
        totalWeight: data.totalOrderWeightKg,
        totalValue: data.totalOrderValue,
      });
    });

    return res.json(orders);
  } catch (error) {
    console.error("Error loading orders for shift:", error.stack);
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

// Admin API to approve a pending employee and move them into their role collection
const roleCollectionMap = {
  farmer: "farmers",
  deliverer: "deliverers",
  industrialDriver: "industrialDrivers",
  sorting: "sorters",
  picker: "pickers",
  "warehouse-worker": "warehouseWorkers",
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
      const targetCol = roleCollectionMap[role];
      if (!targetCol) {
        return res.status(400).send({ error: `Unknown role: ${role}` });
      }

      // 1. Copy to the role-specific collection
      await db
        .collection(targetCol)
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

// Allows an admin to update another user's role in Firebase Authentication and Firestore
// Requires admin authentication via middleware
// Expected body: { uid: string, role: 'customer' | 'employee' | 'admin' | 'pendingEmployee' }
const setRole = async (req, res) => {
  const { uid, role } = req.body;

  try {
    // Set custom user claims in Firebase Auth (used for role-based auth)
    // await admin.auth().setCustomUserClaims(uid, { role });

    // Update the user's role in Firestore document
    await db.collection("users").doc(uid).update({
      role,
    });

    res.send({ message: `Role for user ${uid} updated to ${role}` });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Get employment application from 'employmentApplications/{uid}' for admin
// Returns only relevant fields (excludes createdAt, uid)
const getApplication = async (req, res) => {
  const uid = req.user.uid;

  try {
    // Fetch application document from 'employmentApplications' collection
    const applicationDoc = await db
      .collection("employmentApplications")
      .doc(uid)
      .get();

    // If the document doesn't exist, return 404
    if (!applicationDoc.exists)
      return res.status(404).send({ error: "Application not found" });

    // Return the full application data without filtering
    res.send(applicationDoc.data());
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

// Fetch any user's profile by UID (admin-only route)
const getProfileById = async (req, res) => {
  const uid = req.params.id;

  try {
    // Get the user document from Firestore
    const userDoc = await db.collection("users").doc(uid).get();

    // If user doesn't exist
    if (!userDoc.exists) {
      return res.status(404).send({ error: "User not found" });
    }

    // Return user data (including createdAt, role, etc.)
    res.send(userDoc.data());
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

// Fetch all employment applications from Firestore (admin only)
const getAllApplications = async (req, res) => {
  try {
    const snapshot = await db.collection("employmentApplications").get();

    const applications = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const uid = doc.id;
        const applicationData = doc.data();

        // Only allow 'pending' or 'contacted' statuses
        if (
          applicationData.status !== "pending" &&
          applicationData.status !== "contacted"
        ) {
          return null;
        }
        // Get the user profile using the same UID
        const userDoc = await db.collection("users").doc(uid).get();
        if (!userDoc.exists) {
          console.warn(`User profile not found for UID: ${uid}`);
          return null; // <- return null so we can filter it out
        }
        const userData = userDoc.data();
        return {
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
        };
      })
    );
    res.send(applications.filter((a) => a !== null));
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).send({ error: error.message });
  }
};

// Update a specific user's profile fields (admin only)
const updateUser = async (req, res) => {
  const uid = req.params.id;
  const updates = req.body;

  try {
    await db.collection("users").doc(uid).update(updates);
    res.send({ message: `User ${uid} updated.` });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Delete a user from Firebase Auth and Firestore (admin only)
const deleteUser = async (req, res) => {
  const uid = req.params.id;

  try {
    // Delete from Firebase Auth
    await admin.auth().deleteUser(uid);

    // Fetch user role
    const userRef = await db.collection("users").doc(uid).get();
    if (!userRef.exists) {
      return res.status(404).send({ error: "User not found." });
    }

    const role = userRef.data().role;

    // Delete from employmentApplications (if exists)
    await db.collection("employmentApplications").doc(uid).delete();

    // If not a customer, delete from role-specific collection
    if (role !== "customer") {
      const targetCol = roleCollectionMap[role];
      if (!targetCol) {
        return res.status(400).send({ error: `Unknown role: ${role}` });
      }

      await db.collection(targetCol).doc(uid).delete();
    }

    // If role is farmer, delete all inventory documents belonging to them
    if (role === "farmer") {
      const inventorySnapshot = await db
        .collection("farmerInventory")
        .where("farmerId", "==", uid)
        .get();

      const batch = db.batch();
      inventorySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      if (!inventorySnapshot.empty) {
        await batch.commit();
      }
    }

    // Delete user document
    await db.collection("users").doc(uid).delete();

    res.send({ message: `User ${uid} and associated data deleted.` });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

// Fetch all users from 'users' collection (admin only)
const getAllUsers = async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const users = snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
    res.send(users);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

// // Delete Firebase Auth users that have no corresponding Firestore user doc
// const cleanOrphanedAuthUsers = async (req, res) => {
//   const deleted = [];
//   const skipped = [];
//   let nextPageToken;
//   let totalChecked = 0;

//   try {
//     do {
//       const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
//       const uids = listUsersResult.users.map((user) => user.uid);

//       // Check which of these UIDs exist in Firestore
//       const userChecks = await Promise.all(
//         uids.map(async (uid) => {
//           const doc = await db.collection("users").doc(uid).get();
//           return doc.exists;
//         })
//       );

//       // Delete users that do not exist in Firestore
//       for (let i = 0; i < uids.length; i++) {
//         totalChecked++;
//         if (!userChecks[i]) {
//           await admin.auth().deleteUser(uids[i]);
//           deleted.push(uids[i]);
//         } else {
//           skipped.push(uids[i]);
//         }
//       }

//       nextPageToken = listUsersResult.pageToken;
//     } while (nextPageToken);

//     return res.status(200).send({
//       message: "Orphaned Auth users cleanup complete.",
//       totalChecked,
//       deletedCount: deleted.length,
//       deleted,
//       skippedCount: skipped.length,
//       skipped,
//     });
//   } catch (error) {
//     console.error("Error cleaning orphaned users:", error);
//     return res.status(500).send({ error: error.message });
//   }
// };  cleanOrphanedAuthUsers,

// Import JSON data into a specified Firestore collection
// const importJsonToFirestore = async (req, res) => {
//   const { collection, documents } = req.body;

//   console.log("📥 Received request to import documents:");
//   console.log("➡️ Collection:", collection);
//   console.log("➡️ Documents:", JSON.stringify(documents, null, 2));

//   // Validate input
//   if (
//     !collection ||
//     !documents ||
//     (Array.isArray(documents) && documents.length === 0)
//   ) {
//     console.error("❌ Validation failed");
//     return res.status(400).send({
//       error:
//         "Request must include 'collection' and a non-empty 'documents' object or array.",
//     });
//   }

//   let entries = [];

//   // Determine format
//   if (Array.isArray(documents)) {
//     console.log("🔍 Detected format: Array of documents");
//     entries = documents.map((doc) => {
//       const { id, ...data } = doc;
//       return { id, data };
//     });
//   } else if (typeof documents === "object") {
//     console.log("🔍 Detected format: Object with keys as IDs");
//     entries = Object.entries(documents).map(([id, data]) => ({ id, data }));
//   } else {
//     console.error("❌ Invalid documents format:", typeof documents);
//     return res.status(400).send({ error: "Invalid 'documents' format." });
//   }

//   try {
//     const collectionRef = db.collection(collection);
//     console.log("📁 Writing to collection:", collection);

//     for (const { id, data } of entries) {
//       console.log("📄 Writing doc:", id);
//       console.log("📝 Data:", data);

//       const docRef = id ? collectionRef.doc(id) : collectionRef.doc();
//       await docRef.set(data);
//     }

//     res.status(200).send({
//       message: `✅ Successfully imported ${entries.length} documents into '${collection}' collection.`,
//     });
//   } catch (error) {
//     console.error("🔥 Error during import:", error);
//     res.status(500).send({ error: error.message });
//   }
// };

async function getShipments(req, res) {
  try {
    // Get shipments
    const shipmentsSnapshot = await db.collection("shipment").get();

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

module.exports = {
  updateApplicationStatus,
  setRole,
  getApplication,
  getProfileById,
  getAllApplications,
  updateUser,
  deleteUser,
  getAllUsers,
  getAllApplications,
  getOrdersForUpcomingShifts,
  getOrdersForShift,
  getOrdersWithSummaryForShift,
  getShipments,
};
