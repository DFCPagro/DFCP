const { admin, db } = require("../firebaseConfig"); // make sure db = Firestore instance

// Middleware: Authenticate and fetch user's Firestore profile (including role)
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split("Bearer ")[1];
  //console.log(`[authenticate] Token received: ${token ? 'YES' : 'NO'}`);

  if (!token) return res.status(401).send({ error: "No token provided" });

  try {
    // Verify token
    const decoded = await admin.auth().verifyIdToken(token);
    //console.log(`[authenticate] Token verified for uid: ${decoded.uid}, email: ${decoded.email}`);

    req.user = { uid: decoded.uid, email: decoded.email }; // Initialize user object with uid and email //  role: decoded.role

    // Fetch user role from Firestore
    //console.log(`[authenticate] Fetching user profile from Firestore for uid: ${decoded.uid}`);
    const userDoc = await db.collection("users").doc(decoded.uid).get();

    if (!userDoc.exists) {
      //console.log(`[authenticate] User profile not found in Firestore for uid: ${decoded.uid}`);
      return res.status(403).send({ error: "User profile not found" });
    }

    const userData = userDoc.data();
    //console.log(`[authenticate] User profile found:`, JSON.stringify(userData, null, 2));

    // Explicitly check for role
    if (!userData.role) {
      //console.log(`[authenticate] No role found in user profile for uid: ${decoded.uid}`);
      throw new Error("unauthenticated user ");
    }

    //console.log(`[authenticate] User role: ${userData.role}`);
    req.user.role = userData.role;
    req.user.profile = userData; // Add full profile for debugging

    //console.log(`[authenticate] Final req.user:`, JSON.stringify(req.user, null, 2));

    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).send({ error: "Invalid token" });
  }
};

// Middleware to check if user's role is included in allowed roles array
const requireRole = (roles) => {
  return (req, res, next) => {
    // Ensure roles is always an array
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    // Check if user's role is allowed
    if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).send({ error: "Insufficient permissions" });
    }

    next();
  };
};

module.exports = { authenticate, requireRole };
