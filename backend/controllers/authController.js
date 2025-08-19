const { admin, db } = require("../firebaseConfig");
const bcrypt = require("bcryptjs");

// Map roles/positions to Firestore sub-collections
const roleCollectionMap = {
  customer: "customers",
  farmer: "farmers",
  deliverer: "deliverers",
  industrialDriver: "industrialDrivers",
  sorting: "sorters",
  picker: "pickers",
  "warehouse-worker": "warehouseWorkers",
};

// Register a customer: create Auth user and save profile in both 'customers' and 'users'
const registerCustomer = async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    birthDate,
    address,
    password,
    confirmPassword,
  } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).send({ error: "Passwords do not match" });
  }

  try {
    // Create Auth user
    const userRecord = await admin.auth().createUser({ email, password });
    const uid = userRecord.uid;

    // Hash the password before storing
    const salt = await bcrypt.genSalt(12);
    const hashPass = await bcrypt.hash(password, salt);

    // Save full profile (including hashed password) into users/{uid}
    const now = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("users").doc(uid).set({
      firstName,
      lastName,
      email,
      phone,
      birthDate,
      address,
      role: "customer",
      password: hashPass,
      logisticCenterId: "LC-1",
      createdAt: now,
      updatedAt: now,
    });

    res.status(201).send({ firstName, lastName });
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      return res.status(400).send({ error: "Email already registered" });
    }
    res.status(400).send({ error: error.message });
  }
};

//TODO : remove after checing if this is needed
// Get role from custom claims
const getUserRole = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).send({ error: "Missing or invalid token" });
  }
  const idToken = authHeader.split(" ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const role = decodedToken.role || "unknown";
    res.status(200).send({ role });
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(401).send({ error: "Unauthorized" });
  }
};

const validateExtraFields = (position, fields) => {
  const isString = (v) => typeof v === "string";
  const isBoolean = (v) => typeof v === "boolean";
  const isNumber = (v) => typeof v === "number";
  const isObject = (v) =>
    v !== null && typeof v === "object" && !Array.isArray(v);

  const sched = fields.scheduleBitmask;
  const scheduleValid = Array.isArray(sched) && sched.every(Number.isInteger);

  // Coerce numbers to string where needed
  const toStr = (v) => (typeof v === "number" ? v.toString() : v);

  switch (position) {
    case "farmer":
      return (
        Array.isArray(fields.lands) && isBoolean(fields.agriculturalInsurance)
      );

    case "deliverer":
      return (
        isString(fields.licenseType) &&
        isString(fields.vehicleMake) &&
        isString(fields.vehicleModel) &&
        isString(fields.vehicleType) &&
        isNumber(fields.vehicleYear) &&
        isNumber(fields.vehicleCapacity) &&
        isString(toStr(fields.driverLicenseNumber)) &&
        isString(toStr(fields.vehicleRegistrationNumber)) &&
        isBoolean(fields.vehicleInsurance) &&
        scheduleValid
      );

    case "industrialDriver":
      return (
        isString(fields.licenseType) &&
        isString(fields.vehicleMake) &&
        isString(fields.vehicleModel) &&
        isString(fields.vehicleType) &&
        isNumber(fields.vehicleYear) &&
        isNumber(fields.vehicleCapacity) &&
        isString(toStr(fields.driverLicenseNumber)) &&
        isString(toStr(fields.vehicleRegistrationNumber)) &&
        isBoolean(fields.vehicleInsurance) &&
        isBoolean(fields.refrigerated) &&
        scheduleValid
      );

    default:
      return true; // warehouse, picker, etc.
  }
};

// Request employment: save in role-specific, in employmentApplications AND in users
const requestEmployment = async (req, res) => {
  const { role, extraFields, certifyAccuracy, submittedAt } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }
  const token = authHeader.split(" ")[1];

  const col = roleCollectionMap[role];
  if (!col) {
    return res.status(400).send({ error: "Unknown Role" });
  }
  // ─── End Validation ──────────────────────────────────────────────────────

  if (!certifyAccuracy) {
    return res.status(400).send({ error: "All agreements must be accepted." });
  }

  if (!extraFields || typeof extraFields !== "object") {
    return res
      .status(400)
      .send({ error: "Extra fields are missing or invalid." });
  }

  if (!validateExtraFields(role, extraFields)) {
    return res.status(400).send({
      error: `Invalid or missing extra fields for position '${role}'. Check required inputs.`,
    });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    // Prevent duplicate application
    const existing = await db
      .collection("employmentApplications")
      .doc(uid)
      .get();
    if (existing.exists) {
      return res.status(400).send({ error: "Application already submitted." });
    }

    // Save in role-specific sub-collection
    await db.collection("employmentApplications").doc(uid).set({
      role,
      extraFields,
      status: "pending",
      submittedAt,
    });

    res.status(201).send({
      success: true,
      message: "Application submitted. We will contact you shortly.",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Login: encrypt incoming password, store hash in users collection, then return role
const login = async (req, res) => {
  const { password } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    // 1. Generate a salt & hash the plain password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    // 2. Get user role from db > doc
    const doc = await db.collection("users").doc(uid).get();
    // 3. Save hashed password into users/{uid}.password
    if (!doc.exists) {
      return res.status(404).send({ error: "Profile not found 222" });
    }

    await db.collection("users").doc(uid).set(
      {
        password: hashedPassword,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const user = doc.data();
    // console.log("user", user);
    res.status(200).json({
      role: user.role,
      name: user.firstName + " " + user.lastName,
    });
  } catch (err) {
    console.error("Login error:", err);
    if (err.code === "auth/user-not-found") {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(500).json({ error: err.message });
  }
};
module.exports = {
  registerCustomer,
  getUserRole,
  requestEmployment,
  login,
};
