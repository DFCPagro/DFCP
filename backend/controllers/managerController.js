const { db } = require("../firebaseConfig");

// Get all drivers (transporters and deliverers) for manager dashboard
async function getAllDrivers(req, res) {
  try {
    // Get all transporters
    const transportersSnapshot = await db.collection("transporters").get();
    const transporters = transportersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      type: "transporter",
    }));

    // Get all deliverers
    const deliverersSnapshot = await db.collection("deliverers").get();
    const deliverers = deliverersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      type: "deliverer",
    }));

    // Combine both types
    const allDrivers = [...transporters, ...deliverers];

    res.status(200).json({
      success: true,
      drivers: allDrivers,
      total: allDrivers.length,
    });
  } catch (error) {
    console.error("Error fetching all drivers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch drivers data",
    });
  }
}

// Get all shipments for manager dashboard
async function getAllShipments(req, res) {
  try {
    // Get customer shipments (logistics → customer)
    const customerShipmentsSnapshot = await db
      .collection("customer_shipments")
      .get();
    const customerShipments = customerShipmentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      type: "customer_shipment",
      source: "logistics",
      destination: "customer",
    }));

    // Get farmer shipments (farmer → logistics)
    const farmerShipmentsSnapshot = await db
      .collection("farmer_shipments")
      .get();
    const farmerShipments = farmerShipmentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      type: "farmer_shipment",
      source: "farmer",
      destination: "logistics",
    }));

    // Combine both types
    const allShipments = [...customerShipments, ...farmerShipments];

    res.status(200).json({
      success: true,
      shipments: allShipments,
      total: allShipments.length,
    });
  } catch (error) {
    console.error("Error fetching all shipments:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch shipments data",
    });
  }
}

// Get all shipment problems for manager dashboard
async function getAllProblems(req, res) {
  try {
    const problemsSnapshot = await db.collection("shipment_problems").get();
    const problems = problemsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({
      success: true,
      problems: problems,
      total: problems.length,
    });
  } catch (error) {
    console.error("Error fetching shipment problems:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch problems data",
    });
  }
}

// Get all schedules for manager dashboard
async function getAllSchedules(req, res) {
  try {
    // Get all schedule documents from schedule_management collection
    const scheduleSnapshot = await db.collection("schedule_management").get();

    const schedules = [];

    // Process each schedule document
    for (const scheduleDoc of scheduleSnapshot.docs) {
      const scheduleData = scheduleDoc.data();
      const userId = scheduleDoc.id; // Document ID is the user ID

      // Skip if no meaningful schedule data
      if (!scheduleData.weeklySchedule && !scheduleData.standbyShifts) {
        continue;
      }

      // Get driver info from deliverers collection
      let driverInfo = null;
      try {
        const delivererDoc = await db
          .collection("deliverers")
          .doc(userId)
          .get();
        if (delivererDoc.exists) {
          const delivererData = delivererDoc.data();
          driverInfo = {
            firstName: delivererData.firstName,
            lastName: delivererData.lastName,
            role: delivererData.role,
            availability: delivererData.availability,
            type: "deliverer",
          };
        }
      } catch (error) {
        console.log(`Could not find deliverer info for user ${userId}`);
      }

      // If no deliverer info found, try transporters collection
      if (!driverInfo) {
        try {
          const transporterDoc = await db
            .collection("transporters")
            .doc(userId)
            .get();
          if (transporterDoc.exists) {
            const transporterData = transporterDoc.data();
            driverInfo = {
              firstName: transporterData.firstName,
              lastName: transporterData.lastName,
              role: transporterData.role,
              availability: transporterData.availability,
              type: "transporter",
            };
          }
        } catch (error) {
          console.log(`Could not find transporter info for user ${userId}`);
        }
      }

      // Create schedule entry
      const scheduleEntry = {
        id: `schedule_${userId}`,
        driverId: userId,
        driverName: driverInfo
          ? `${driverInfo.firstName || ""} ${
              driverInfo.lastName || ""
            }`.trim() || "Unknown"
          : "Unknown Driver",
        driverType: driverInfo ? driverInfo.type : "unknown",
        role: driverInfo ? driverInfo.role : "unknown",
        schedule: scheduleData.weeklySchedule || {},
        standbyShifts: scheduleData.standbyShifts || [],
        availability: driverInfo
          ? driverInfo.availability || "unknown"
          : "unknown",
        updatedAt: scheduleData.updatedAt,
      };

      schedules.push(scheduleEntry);
    }

    res.status(200).json({
      success: true,
      schedules: schedules,
      total: schedules.length,
    });
  } catch (error) {
    console.error("Error fetching schedules:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch schedules data",
    });
  }
}

// Get dashboard overview statistics
async function getDashboardOverview(req, res) {
  try {
    // Get counts from different collections
    const [
      transportersSnapshot,
      deliverersSnapshot,
      customerShipmentsSnapshot,
      farmerShipmentsSnapshot,
      problemsSnapshot,
    ] = await Promise.all([
      db.collection("transporters").get(),
      db.collection("deliverers").get(),
      db.collection("customer_shipments").get(),
      db.collection("farmer_shipments").get(),
      db.collection("shipment_problems").get(),
    ]);

    // Calculate statistics
    const totalDrivers = transportersSnapshot.size + deliverersSnapshot.size;
    const totalShipments =
      customerShipmentsSnapshot.size + farmerShipmentsSnapshot.size;
    const totalProblems = problemsSnapshot.size;

    // Count shipments by status - handle both customer and farmer shipments
    const statusCounts = {};

    // Process customer shipments
    customerShipmentsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const status = data.status || "pending";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Process farmer shipments (status is now at top level)
    farmerShipmentsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const status = data.status || "pending";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Count active drivers (drivers currently assigned to shipments in "in_transportation" status)
    const activeDrivers = new Set();

    // Check customer shipments
    customerShipmentsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.driver && data.status === "in_transportation") {
        activeDrivers.add(data.driver);
      }
    });

    // Check farmer shipments
    farmerShipmentsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.driver && data.status === "in_transportation") {
        activeDrivers.add(data.driver);
      }
    });

    // Get recent shipments for activity feed
    const allShipmentsForActivity = [];

    // Add customer shipments with proper timestamp handling
    customerShipmentsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      allShipmentsForActivity.push({
        id: doc.id,
        type: "customer_shipment",
        status: data.status || "pending",
        updatedAt: data.statusUpdatedAt || data.updatedAt || data.createdAt,
        createdAt: data.createdAt,
        ...data,
      });
    });

    // Add farmer shipments with proper timestamp handling
    farmerShipmentsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      allShipmentsForActivity.push({
        id: doc.id,
        type: "farmer_shipment",
        status: data.status || "pending",
        updatedAt: data.statusUpdatedAt || data.updatedAt || data.createdAt,
        createdAt: data.createdAt,
        ...data,
      });
    });

    const overview = {
      totalDrivers,
      totalShipments,
      totalProblems,
      activeDrivers: activeDrivers.size,
      shipmentStatusBreakdown: statusCounts,
      recentShipments: allShipmentsForActivity
        .sort((a, b) => {
          const aTime = a.updatedAt?.toDate
            ? a.updatedAt.toDate()
            : new Date(a.updatedAt || a.createdAt);
          const bTime = b.updatedAt?.toDate
            ? b.updatedAt.toDate()
            : new Date(b.updatedAt || b.createdAt);
          return bTime - aTime;
        })
        .slice(0, 10), // Get top 10 recent shipments
      recentActivity: {
        newShipmentsToday: allShipmentsForActivity.filter((s) => {
          const createdAt = s.createdAt?.toDate
            ? s.createdAt.toDate()
            : new Date(s.createdAt);
          const today = new Date();
          return createdAt.toDateString() === today.toDateString();
        }).length,
        problemsToday: problemsSnapshot.docs.filter((doc) => {
          const data = doc.data();
          const reportedAt = data.timestamp?.toDate
            ? data.timestamp.toDate()
            : new Date(data.timestamp);
          const today = new Date();
          return reportedAt.toDateString() === today.toDateString();
        }).length,
      },
    };

    res.status(200).json({
      success: true,
      overview,
    });
  } catch (error) {
    console.error("Error fetching dashboard overview:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard overview",
    });
  }
}

// Resolve a shipment problem (mark as resolved)
async function resolveProblem(req, res) {
  try {
    const { problemId } = req.params;
    const { resolution, resolvedBy } = req.body;

    // Update the problem document
    await db
      .collection("shipment_problems")
      .doc(problemId)
      .update({
        status: "resolved",
        resolution: resolution || "Problem resolved by manager",
        resolvedBy: resolvedBy || req.user.uid,
        resolvedAt: new Date(),
      });

    res.status(200).json({
      success: true,
      message: "Problem resolved successfully",
    });
  } catch (error) {
    console.error("Error resolving problem:", error);
    res.status(500).json({
      success: false,
      error: "Failed to resolve problem",
    });
  }
}

// Update driver status (active/inactive)
async function updateDriverStatus(req, res) {
  try {
    const { driverId } = req.params;
    const { status, driverType } = req.body;

    // Determine collection based on driver type
    const collection =
      driverType === "deliverer" ? "deliverers" : "transporters";

    await db.collection(collection).doc(driverId).update({
      availability: status,
      lastUpdated: new Date(),
    });

    res.status(200).json({
      success: true,
      message: "Driver status updated successfully",
    });
  } catch (error) {
    console.error("Error updating driver status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update driver status",
    });
  }
}

// Get driver role by ID - checks both users and deliverers collections
async function getDriverRole(req, res) {
  try {
    const { driverId } = req.params;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        error: "Driver ID is required",
      });
    }

    // Try users collection first
    const userDoc = await db.collection("users").doc(driverId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData.role) {
        return res.status(200).json({
          success: true,
          role: userData.role,
          source: "users",
        });
      }
    }

    // Try deliverers collection
    const delivererDoc = await db.collection("deliverers").doc(driverId).get();
    if (delivererDoc.exists) {
      const delivererData = delivererDoc.data();
      if (delivererData.role) {
        return res.status(200).json({
          success: true,
          role: delivererData.role,
          source: "deliverers",
        });
      }
    }

    // Try transporters collection
    const transporterDoc = await db
      .collection("transporters")
      .doc(driverId)
      .get();
    if (transporterDoc.exists) {
      const transporterData = transporterDoc.data();
      if (transporterData.role) {
        return res.status(200).json({
          success: true,
          role: transporterData.role,
          source: "transporters",
        });
      }
    }

    // Driver not found
    return res.status(404).json({
      success: false,
      error: "Driver not found or role not specified",
    });
  } catch (error) {
    console.error("Error fetching driver role:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch driver role",
    });
  }
}

module.exports = {
  getAllDrivers,
  getAllShipments,
  getAllProblems,
  getAllSchedules,
  getDashboardOverview,
  resolveProblem,
  updateDriverStatus,
  getDriverRole,
};
