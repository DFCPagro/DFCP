const { admin, db } = require("../firebaseConfig");
const { emailDocuments } = require("../info/contactInfo");

// At top of your authController.js (or wherever getProfile lives):
const roleCollectionMap = {
  customer: "users",
  farmer: "farmers",
  deliverer: "deliverers",
  industrialDriver: "industrialDrivers",
  sorting: "sorters",
  picker: "pickers",
  "warehouse-worker": "warehouseWorkers",
};

// GET /profile
const getProfile = async (req, res) => {
  const uid = req.user.uid;
  const role = req.user.role; // assume authMiddleware sets req.user.role

  // choose collection: role-specific if known, otherwise fallback to 'users'
  const collection = roleCollectionMap[role] || "users";

  try {
    const doc = await db.collection(collection).doc(uid).get();
    if (!doc.exists) {
      return res.status(404).send({ error: "Profile not found 222" });
    }

    // merge in generic fields if you still need them:
    // if you want to include 'users' doc even when role-specific exists:
    // const userDoc = await db.collection("users").doc(uid).get();
    // const base = userDoc.exists ? userDoc.data() : {};
    //
    // const profileData = filterFields({ ...base, ...doc.data() });

    const profileData = filterFields(doc.data());
    res.json(profileData);
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).send({ error: err.message });
  }
};

// Helper to remove unwanted fields from a document (e.g., createdAt, uid)
const filterFields = (data) => {
  const { createdAt, uid, approvedAt, ...rest } = data; // ???? -createdAt
  return rest;
};

const getEmailDocumnets = async (req, res) => {
  try {
    return res.send({ emailDocuments });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

// Get employment application from 'employmentApplications/{uid}' for user itself
// Returns only status
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
    res.send(applicationDoc.data().status);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

module.exports = {
  getProfile,
  getEmailDocumnets,
  getApplication,
};
