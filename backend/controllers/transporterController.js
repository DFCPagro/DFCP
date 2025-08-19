const { db, admin } = require("../firebaseConfig");

// Create or update transporter profile
async function upsertTransporterProfile(req, res) {
  try {
    const {
      name,
      phone,
      licenseType,
      vehicleType,
      vehicleCapacity,
      driverLicenseNumber,
      vehicleRegistrationNumber,
      insurance,
      refrigerated,
      acceptAgreement,
      certifyAccuracy,
      availabilitySchedule,
      regions,
      availability,
      currentLocation,
    } = req.body;

    // Determine which collection to use based on user role
    let collectionName;
    switch (req.user.role) {
      case "deliverer":
        collectionName = "deliverers";
        break;
      case "industrialDriver":
        collectionName = "deliverers"; // or "drivers" if that collection exists
        break;

      default:
        return res
          .status(400)
          .send({ error: "Invalid user role for transporter profile" });
    }

    // Split name into firstName and lastName if provided as single string
    const nameParts = name ? name.split(" ") : [];
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const profile = {
      userId: req.user.uid,
      firstName,
      lastName,
      phone,
      licenseType,
      vehicleType,
      vehicleCapacity,
      driverLicenseNumber,
      vehicleRegistrationNumber,
      vehicleInsurance: insurance,
      refrigerated,
      acceptAgreement,
      certifyAccuracy,
      availabilitySchedule,
      regions,
      availability: availability || "available",
      currentLocation,
      updatedAt: new Date().toISOString(),
      // Keep extra fields for deliverer compatibility
      extraFields: {
        licenseType,
        vehicleType,
        vehicleCapacity,
        driverLicenseNumber,
        vehicleRegistrationNumber,
        vehicleInsurance: insurance,
      },
    };

    await db
      .collection(collectionName)
      .doc(req.user.uid)
      .set(profile, { merge: true });

    console.log(
      `Profile updated for user: ${req.user.uid} in collection: ${collectionName}`
    );

    res.status(200).json({
      message: "Profile updated successfully",
      profile,
      collection: collectionName,
    });
  } catch (err) {
    console.error("Error in upsertTransporterProfile:", err);
    res.status(500).send({ error: err.message });
  }
}

// Get own transporter profile
async function getMyTransporterProfile(req, res) {
  try {
    console.log(
      `Getting profile for user: ${req.user.uid}, role: ${req.user.role}`
    );

    // For deliverers, fetch data from BOTH users and deliverers collections
    if (req.user.role === "deliverer" || req.user.role === "industrialDriver") {
      try {
        // Fetch from both collections simultaneously
        const [usersDoc, deliverersDoc] = await Promise.all([
          db.collection("users").doc(req.user.uid).get(),
          db.collection("deliverers").doc(req.user.uid).get(),
        ]);

        let userData = {};
        let delivererData = {};

        if (usersDoc.exists) {
          userData = usersDoc.data();
          console.log(`User data found for: ${req.user.uid}`);
        } else {
          console.log(`No user data found for: ${req.user.uid}`);
        }

        if (deliverersDoc.exists) {
          delivererData = deliverersDoc.data();
          console.log(`Deliverer data found for: ${req.user.uid}`);
        } else {
          console.log(`No deliverer data found for: ${req.user.uid}`);
        }

        // If neither collection has data, return 404
        if (!usersDoc.exists && !deliverersDoc.exists) {
          return res.status(404).send({
            error: "Profile not found in users or deliverers collections",
            userId: req.user.uid,
          });
        }

        // Merge data from both collections, prioritizing specific fields from each
        const mergedProfile = {
          userId: req.user.uid,
          // Personal info from users collection
          name: `${userData.firstName || ""} ${userData.lastName || ""}`.trim(),
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          phone: userData.phone || delivererData.phone, // Fallback to deliverer phone if users phone is missing
          address: userData.address,
          birthDate: userData.birthDate,
          logisticCenterId: userData.logisticCenterId,
          role: userData.role || delivererData.role,

          // Vehicle and license info from deliverers collection (with extraFields fallback)
          vehicleType:
            delivererData.vehicleType || delivererData.extraFields?.vehicleType,
          vehicleCapacity:
            delivererData.vehicleCapacity ||
            delivererData.extraFields?.vehicleCapacity,
          vehicleMake:
            delivererData.vehicleMake || delivererData.extraFields?.vehicleMake,
          vehicleModel:
            delivererData.vehicleModel ||
            delivererData.extraFields?.vehicleModel,
          vehicleYear:
            delivererData.vehicleYear || delivererData.extraFields?.vehicleYear,
          driverLicenseNumber:
            delivererData.driverLicenseNumber ||
            delivererData.extraFields?.driverLicenseNumber,
          vehicleRegistrationNumber:
            delivererData.vehicleRegistrationNumber ||
            delivererData.extraFields?.vehicleRegistrationNumber,
          licenseType:
            delivererData.licenseType || delivererData.extraFields?.licenseType,
          insurance:
            delivererData.vehicleInsurance ||
            delivererData.extraFields?.vehicleInsurance,

          // Status and approval info from deliverers collection
          status: delivererData.status,
          approvedAt: delivererData.approvedAt,
          submittedAt: delivererData.submittedAt,

          // Timestamps
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt,

          // Include all original fields from both collections
          ...userData,
          ...delivererData,

          // Ensure merged name takes precedence
          name: `${userData.firstName || ""} ${userData.lastName || ""}`.trim(),
        };

        console.log(`Merged profile created for user: ${req.user.uid}`);
        res.json({ profile: mergedProfile });
      } catch (mergeError) {
        console.error("Error merging profile data:", mergeError);
        res.status(500).send({
          error: "Failed to merge profile data: " + mergeError.message,
        });
      }
    } else {
      // For non-deliverer roles, use the original logic
      let profileDoc;
      let collectionName;

      switch (req.user.role) {
        case "industrialDriver":
          collectionName = "deliverers"; // or "drivers" if that collection exists
          break;

        default:
          return res
            .status(400)
            .send({ error: "Invalid user role for transporter profile" });
      }

      profileDoc = await db.collection(collectionName).doc(req.user.uid).get();

      if (!profileDoc.exists) {
        console.log(
          `No profile found for user: ${req.user.uid} in collection: ${collectionName}`
        );
        return res.status(404).send({
          error: "Profile not found",
          collection: collectionName,
          userId: req.user.uid,
        });
      }

      console.log(
        `Profile found for user: ${req.user.uid} in collection: ${collectionName}`
      );
      const profileData = profileDoc.data();

      // Normalize the profile data to match expected frontend format
      const normalizedProfile = {
        userId: req.user.uid,
        name: `${profileData.firstName || ""} ${
          profileData.lastName || ""
        }`.trim(),
        phone: profileData.phone,
        email: profileData.email,
        address: profileData.address,
        vehicleType:
          profileData.vehicleType || profileData.extraFields?.vehicleType,
        vehicleCapacity:
          profileData.vehicleCapacity ||
          profileData.extraFields?.vehicleCapacity,
        driverLicenseNumber:
          profileData.driverLicenseNumber ||
          profileData.extraFields?.driverLicenseNumber,
        vehicleRegistrationNumber:
          profileData.vehicleRegistrationNumber ||
          profileData.extraFields?.vehicleRegistrationNumber,
        licenseType:
          profileData.licenseType || profileData.extraFields?.licenseType,
        insurance:
          profileData.vehicleInsurance ||
          profileData.extraFields?.vehicleInsurance,
        vehicleMake:
          profileData.vehicleMake || profileData.extraFields?.vehicleMake,
        vehicleModel:
          profileData.vehicleModel || profileData.extraFields?.vehicleModel,
        vehicleYear:
          profileData.vehicleYear || profileData.extraFields?.vehicleYear,
        status: profileData.status,
        position: profileData.position,
        scheduleBitmask: profileData.scheduleBitmask,
        ...profileData, // Include all original fields
      };

      res.json({ profile: normalizedProfile });
    }
  } catch (err) {
    console.error("Error in getMyTransporterProfile:", err);
    res.status(500).send({ error: err.message });
  }
}

// List all available shipments
async function listAvailableShipments(req, res) {
  try {
    const allShipments = [];

    // Get customer shipments (logistics → customer)
    const customerShipmentsRef = db.collection("customer_shipments");
    const customerQuery = customerShipmentsRef
      .where("status", "in", ["at_pickup", "pending", "available_shipment"])
      .where("driver", "==", null);

    const customerSnapshot = await customerQuery.get();
    const customerShipments = customerSnapshot.docs.map((doc) => ({
      id: doc.id,
      type: "customer_shipment",
      ...doc.data(),
    }));

    // Get farmer shipments (farmer → logistics)
    const farmerShipmentsRef = db.collection("farmer_shipments");
    const farmerSnapshot = await farmerShipmentsRef.get();

    const farmerShipments = [];
    farmerSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      // Only include if driver field is null and status is appropriate
      if (
        data.driver === null &&
        ["at_pickup", "pending", "available_shipment"].includes(
          data.status || "pending"
        )
      ) {
        farmerShipments.push({
          id: doc.id,
          type: "farmer_shipment",
          ...data,
        });
      }
    });

    // Combine both types
    allShipments.push(...customerShipments, ...farmerShipments);

    res.json({ shipments: allShipments });
  } catch (err) {
    console.error("Error in listAvailableShipments:", err);
    res.status(500).send({ error: err.message });
  }
}

// Accept a shipment
async function acceptShipment(req, res) {
  try {
    const { shipmentId } = req.params;
    const { shipmentType } = req.body; // new parameter to identify shipment type

    let shipmentRef;
    let updateData;

    if (shipmentType === "farmer_shipment") {
      // Handle farmer shipments
      shipmentRef = db.collection("farmer_shipments").doc(shipmentId);
      updateData = {
        driver: req.user.uid,
        status: "at_pickup",
        assignedAt: new Date().toISOString(),
      };
    } else {
      // Handle customer shipments (default)
      shipmentRef = db.collection("customer_shipments").doc(shipmentId);
      updateData = {
        driver: req.user.uid,
        status: "at_pickup",
        assignedAt: new Date().toISOString(),
      };
    }

    const shipmentDoc = await shipmentRef.get();

    if (!shipmentDoc.exists) {
      return res.status(404).send({ error: "Shipment not found" });
    }

    const shipmentData = shipmentDoc.data();

    if (shipmentData.driver) {
      return res.status(400).send({ error: "Shipment already assigned" });
    }

    await shipmentRef.update(updateData);

    res.json({
      message: "Shipment accepted successfully",
      shipmentId,
    });
  } catch (err) {
    console.error("Error in acceptShipment:", err);
    res.status(500).send({ error: err.message });
  }
}

// List transporter's own shipments
async function getMyShipments(req, res) {
  try {
    const allShipments = [];

    // Get customer shipments assigned to this driver
    const customerShipmentsRef = db.collection("customer_shipments");
    const customerQuery = customerShipmentsRef.where(
      "driver",
      "==",
      req.user.uid
    );
    const customerSnapshot = await customerQuery.get();

    // Process customer shipments
    for (const doc of customerSnapshot.docs) {
      const shipmentData = doc.data();
      let driverInfo = null;

      if (shipmentData.driver) {
        driverInfo = await getDriverInfo(shipmentData.driver);
      }

      allShipments.push({
        id: doc.id,
        type: "customer_shipment",
        ...shipmentData,
        driverInfo, // Add driver info for frontend display
      });
    }

    // Get farmer shipments assigned to this driver
    const farmerShipmentsRef = db.collection("farmer_shipments");
    const farmerSnapshot = await farmerShipmentsRef
      .where("driver", "==", req.user.uid)
      .get();

    // Process farmer shipments
    for (const doc of farmerSnapshot.docs) {
      const shipmentData = doc.data();
      let driverInfo = null;

      if (shipmentData.driver) {
        driverInfo = await getDriverInfo(shipmentData.driver);
      }

      allShipments.push({
        id: doc.id,
        type: "farmer_shipment",
        ...shipmentData,
        driverInfo, // Add driver info for frontend display
      });
    }

    res.json({ shipments: allShipments });
  } catch (err) {
    console.error("Error in getMyShipments:", err);
    res.status(500).send({ error: err.message });
  }
}

// Update status of shipment (at_pickup, in_transportation, arrived, problem)
async function updateShipmentStatus(req, res) {
  try {
    const { shipmentId } = req.params;
    const { status, shipmentType } = req.body;

    const validStatuses = [
      "at_pickup",
      "in_transportation",
      "arrived",
      "problem",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).send({
        error: "Invalid status. Valid statuses: " + validStatuses.join(", "),
      });
    }

    let shipmentRef;
    let updateData;
    let currentStatus;

    if (shipmentType === "farmer_shipment") {
      // Handle farmer shipments - update items array status
      shipmentRef = db.collection("farmer_shipments").doc(shipmentId);
      const shipmentDoc = await shipmentRef.get();

      if (!shipmentDoc.exists) {
        return res.status(404).send({ error: "Shipment not found" });
      }

      const shipmentData = shipmentDoc.data();

      // Check if user is authorized to update this shipment
      if (shipmentData.driver !== req.user.uid) {
        return res
          .status(403)
          .send({ error: "Unauthorized to update this shipment" });
      }

      // Get current status from top level
      currentStatus = shipmentData.status || null;

      // Update status at top level for farmer shipments
      updateData = {
        status,
        statusUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Handle customer shipments (default)
      shipmentRef = db.collection("customer_shipments").doc(shipmentId);
      const shipmentDoc = await shipmentRef.get();

      if (!shipmentDoc.exists) {
        return res.status(404).send({ error: "Shipment not found" });
      }

      const shipmentData = shipmentDoc.data();

      // Check if user is authorized to update this shipment
      if (shipmentData.driver !== req.user.uid) {
        return res
          .status(403)
          .send({ error: "Unauthorized to update this shipment" });
      }

      // Get current status for customer shipments
      currentStatus = shipmentData.status;

      updateData = {
        status,
        statusUpdatedAt: new Date().toISOString(),
      };
    }

    // Update the shipment status
    await shipmentRef.update(updateData);

    // Auto-delete problem report if status is changed FROM "problem" TO something else
    if (currentStatus === "problem" && status !== "problem") {
      try {
        const problemRef = db.collection("shipment_problems").doc(shipmentId);
        const problemDoc = await problemRef.get();

        if (problemDoc.exists) {
          await problemRef.delete();
          console.log(
            `Auto-deleted problem report for shipment ${shipmentId} (status changed from problem to ${status})`
          );
        }
      } catch (problemError) {
        console.error(
          `Error deleting problem report for shipment ${shipmentId}:`,
          problemError
        );
        // Don't fail the status update if problem deletion fails
      }
    }

    res.json({
      message: "Shipment status updated successfully",
      shipmentId,
      status,
    });
  } catch (err) {
    console.error("Error in updateShipmentStatus:", err);
    res.status(500).send({ error: err.message });
  }
}

// ========================
// SCHEDULE MANAGEMENT
// ========================

// Get available shifts for scheduling
async function getAvailableShifts(req, res) {
  try {
    const shifts = {
      daysOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      timeSlots: ["Morning", "Afternoon", "Evening", "Night"],
    };

    res.json({ shifts });
  } catch (err) {
    console.error("Error in getAvailableShifts:", err);
    res.status(500).send({ error: err.message });
  }
}

// Set weekly schedule (first-time setup)
async function setWeeklySchedule(req, res) {
  try {
    const { weeklySchedule } = req.body;

    if (!weeklySchedule || typeof weeklySchedule !== "object") {
      return res.status(400).send({ error: "Invalid weekly schedule data" });
    }

    const scheduleData = {
      userId: req.user.uid,
      weeklySchedule,
      isInitialSetup: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db
      .collection("transporterSchedules")
      .doc(req.user.uid)
      .set(scheduleData, { merge: true });

    res.status(200).json({
      message: "Weekly schedule set successfully",
      schedule: scheduleData,
    });
  } catch (err) {
    console.error("Error in setWeeklySchedule:", err);
    res.status(500).send({ error: err.message });
  }
}

// Get monthly schedule
async function getMonthlySchedule(req, res) {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).send({ error: "Year and month are required" });
    }

    const scheduleDoc = await db
      .collection("transporterSchedules")
      .doc(req.user.uid)
      .get();

    let weeklySchedule = {};
    let monthlyOverrides = {};
    let standbyShifts = [];

    if (scheduleDoc.exists) {
      const data = scheduleDoc.data();
      weeklySchedule = data.weeklySchedule || {};
      monthlyOverrides = data.monthlyOverrides || {};
      standbyShifts = data.standbyShifts || [];
    }

    const monthlySchedule = generateMonthlySchedule(
      parseInt(year),
      parseInt(month),
      weeklySchedule,
      monthlyOverrides,
      standbyShifts
    );

    res.json({
      monthlySchedule,
      year: parseInt(year),
      month: parseInt(month),
      weeklySchedule,
      monthlyOverrides,
      standbyShifts,
    });
  } catch (err) {
    console.error("Error in getMonthlySchedule:", err);
    res.status(500).send({ error: err.message });
  }
}

// Update specific date in monthly schedule
async function updateMonthlyScheduleDate(req, res) {
  try {
    const { date } = req.params;
    const { shifts } = req.body;

    if (!Array.isArray(shifts)) {
      return res.status(400).send({ error: "Shifts must be an array" });
    }

    const inputDate = new Date(date);
    const today = new Date();
    const diffTime = inputDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 10) {
      return res.status(400).send({
        error: "Schedule changes must be made at least 10 days in advance",
      });
    }

    const scheduleRef = db.collection("transporterSchedules").doc(req.user.uid);
    const scheduleDoc = await scheduleRef.get();

    let monthlyOverrides = {};
    if (scheduleDoc.exists) {
      monthlyOverrides = scheduleDoc.data().monthlyOverrides || {};
    }

    monthlyOverrides[date] = shifts;

    await scheduleRef.set(
      {
        userId: req.user.uid,
        monthlyOverrides,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    res.json({
      message: "Schedule updated successfully",
      date,
      shifts,
    });
  } catch (err) {
    console.error("Error in updateMonthlyScheduleDate:", err);
    res.status(500).send({ error: err.message });
  }
}

// Update standby shifts
async function updateStandbyShifts(req, res) {
  try {
    const { standbyShifts } = req.body;

    if (!Array.isArray(standbyShifts)) {
      return res.status(400).send({ error: "Standby shifts must be an array" });
    }

    if (standbyShifts.length < 10) {
      return res.status(400).send({
        error: "At least 10 standby shifts are required",
      });
    }

    const scheduleRef = db.collection("transporterSchedules").doc(req.user.uid);

    await scheduleRef.set(
      {
        userId: req.user.uid,
        standbyShifts,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    res.json({
      message: "Standby shifts updated successfully",
      standbyShifts,
    });
  } catch (err) {
    console.error("Error in updateStandbyShifts:", err);
    res.status(500).send({ error: err.message });
  }
}

// Helper function to generate monthly schedule
function generateMonthlySchedule(
  year,
  month,
  weeklySchedule,
  monthlyOverrides,
  standbyShifts
) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthlySchedule = {};

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${month.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}`;
    const dayOfWeek = new Date(year, month - 1, day).toLocaleDateString(
      "en-US",
      {
        weekday: "long",
      }
    );

    if (monthlyOverrides[date]) {
      monthlySchedule[date] = monthlyOverrides[date];
    } else {
      monthlySchedule[date] = weeklySchedule[dayOfWeek] || [];
    }

    const standbyForDate = standbyShifts.filter(
      (standby) => standby.date === date
    );
    if (standbyForDate.length > 0) {
      if (!monthlySchedule[date]) {
        monthlySchedule[date] = [];
      }
      standbyForDate.forEach((standby) => {
        if (!monthlySchedule[date].includes(standby.shift)) {
          monthlySchedule[date].push(standby.shift);
        }
      });
    }
  }

  return monthlySchedule;
}

// ========================
// DELIVERER-SPECIFIC FEATURES
// ========================

// Log arrival at logistics center (deliverer check-in)
async function logArrival(req, res) {
  try {
    const arrivalTime = new Date().toISOString();

    await db.collection("arrivals").add({
      driverId: req.user.uid,
      arrivalTime,
      location: "Logistics Center",
      type: "check_in",
    });

    res.json({
      message: "Arrival logged successfully",
      arrivalTime,
    });
  } catch (err) {
    console.error("Error in logArrival:", err);
    res.status(500).send({ error: err.message });
  }
}

// Get pickup notifications for deliverer
async function getPickupNotifications(req, res) {
  try {
    const query = db
      .collection("pickupNotifications")
      .where("delivererId", "==", req.user.uid);

    const snapshot = await query.get();
    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ notifications });
  } catch (err) {
    console.error("Error in getPickupNotifications:", err);
    res.status(500).send({ error: err.message });
  }
}

// Get pickup location for specific order
async function getPickupLocation(req, res) {
  try {
    const { orderId } = req.params;

    const orderQuery = await db
      .collection("orders")
      .where("orderId", "==", orderId)
      .get();

    if (orderQuery.empty) {
      const orderRef = db.collection("orders").doc(orderId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
        return res.status(404).send({ error: "Order not found" });
      }

      const orderData = orderDoc.data();
      res.json({
        orderId,
        pickupLocation: orderData.pickupLocation,
        specialInstructions: orderData.specialInstructions,
        items: orderData.items,
        qrCode: orderData.qrCode,
      });
    } else {
      const orderData = orderQuery.docs[0].data();
      res.json({
        orderId,
        pickupLocation: orderData.pickupLocation,
        specialInstructions: orderData.specialInstructions,
        items: orderData.items,
        qrCode: orderData.qrCode,
      });
    }
  } catch (err) {
    console.error("Error in getPickupLocation:", err);
    res.status(500).send({ error: err.message });
  }
}

// Confirm order pickup
async function confirmPickup(req, res) {
  try {
    const { orderId } = req.params;
    const { qrCodeScanned, ordersCollected } = req.body;

    const timestamp = new Date().toISOString();

    const orderQuery = await db
      .collection("orders")
      .where("orderId", "==", orderId)
      .get();

    if (orderQuery.empty) {
      const orderRef = db.collection("orders").doc(orderId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
        return res.status(404).send({ error: "Order not found" });
      }

      await orderRef.update({
        status: "picked_up",
        pickedUpAt: timestamp,
        pickedUpBy: req.user.uid,
        qrCodeVerified: qrCodeScanned,
        itemsCollected: ordersCollected,
      });
    } else {
      const orderRef = orderQuery.docs[0].ref;
      await orderRef.update({
        status: "picked_up",
        pickedUpAt: timestamp,
        pickedUpBy: req.user.uid,
        qrCodeVerified: qrCodeScanned,
        itemsCollected: ordersCollected,
      });
    }

    res.json({
      message: "Pickup confirmed",
      orderId,
      timestamp,
      qrCodeVerified: qrCodeScanned,
    });
  } catch (err) {
    console.error("Error in confirmPickup:", err);
    res.status(500).send({ error: err.message });
  }
}

// Get delivery route
async function getDeliveryRoute(req, res) {
  try {
    const { deliveryId } = req.params;

    const deliveryQuery = await db
      .collection("deliveries")
      .where("deliveryId", "==", deliveryId)
      .get();

    if (deliveryQuery.empty) {
      const deliveryRef = db.collection("deliveries").doc(deliveryId);
      const deliveryDoc = await deliveryRef.get();

      if (!deliveryDoc.exists) {
        return res.status(404).send({ error: "Delivery not found" });
      }

      const deliveryData = deliveryDoc.data();
      res.json({
        deliveryId,
        route: deliveryData.route,
        orderIds: deliveryData.orderIds,
        currentStop: deliveryData.currentStop,
        mapUrl: deliveryData.mapUrl,
        estimatedDuration: deliveryData.estimatedDuration,
      });
    } else {
      const deliveryData = deliveryQuery.docs[0].data();
      res.json({
        deliveryId,
        route: deliveryData.route,
        orderIds: deliveryData.orderIds,
        currentStop: deliveryData.currentStop,
        mapUrl: deliveryData.mapUrl,
        estimatedDuration: deliveryData.estimatedDuration,
      });
    }
  } catch (err) {
    console.error("Error in getDeliveryRoute:", err);
    res.status(500).send({ error: err.message });
  }
}

// Confirm delivery - FIXED
async function confirmDelivery(req, res) {
  try {
    const { orderId } = req.params;
    const {
      qrCodeScanned,
      deliveryPhoto,
      deliveryMethod,
      customerSignature,
      locationNotes,
    } = req.body;

    const timestamp = new Date().toISOString();

    // First try to find by orderId field
    const orderQuery = await db
      .collection("orders")
      .where("orderId", "==", orderId)
      .get();

    const updateData = {
      status: "delivered",
      deliveredAt: timestamp,
      deliveredBy: req.user.uid,
      qrCodeVerified: qrCodeScanned || false,
    };

    // Only add fields if they exist and are not undefined
    if (deliveryPhoto !== undefined) updateData.deliveryPhoto = deliveryPhoto;
    if (deliveryMethod !== undefined)
      updateData.deliveryMethod = deliveryMethod;
    if (customerSignature !== undefined)
      updateData.customerSignature = customerSignature;
    if (locationNotes !== undefined) updateData.locationNotes = locationNotes;

    if (orderQuery.empty) {
      // Try by document ID
      const orderRef = db.collection("orders").doc(orderId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
        return res.status(404).send({ error: "Order not found" });
      }

      await orderRef.update(updateData);
    } else {
      // Update the found document
      const orderRef = orderQuery.docs[0].ref;
      await orderRef.update(updateData);
    }

    res.status(200).json({
      message: "Delivery confirmed",
      orderId,
      timestamp,
      deliveryMethod: deliveryMethod || "delivered",
    });
  } catch (err) {
    console.error("Error in confirmDelivery:", err);
    console.error("Error details:", err.message);
    res.status(500).send({ error: err.message });
  }
}

// ========================
// INDUSTRIAL DRIVER-SPECIFIC FEATURES
// ========================

// Get available farm pickups for industrial drivers
async function getAvailablePickups(req, res) {
  try {
    const query = db
      .collection("farmPickups")
      .where("status", "==", "available");

    const snapshot = await query.get();
    const pickups = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ pickups });
  } catch (err) {
    console.error("Error in getAvailablePickups:", err);
    res.status(500).send({ error: err.message });
  }
}

// Start shift for industrial driver
async function startShift(req, res) {
  try {
    const { location } = req.body;

    const shiftData = {
      userId: req.user.uid,
      startTime: new Date().toISOString(),
      location,
      status: "active",
    };

    const docRef = await db.collection("driverShifts").add(shiftData);

    res.json({
      message: "Shift started successfully",
      shiftId: docRef.id,
      startTime: shiftData.startTime,
    });
  } catch (err) {
    console.error("Error in startShift:", err);
    res.status(500).send({ error: err.message });
  }
}

// Get departure alerts for industrial drivers
async function getDepartureAlerts(req, res) {
  try {
    const query = db
      .collection("departureAlerts")
      .where("driverId", "==", req.user.uid);

    const snapshot = await query.get();
    const alerts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ alerts });
  } catch (err) {
    console.error("Error in getDepartureAlerts:", err);
    res.status(500).send({ error: err.message });
  }
}

// Get pickup route for shipment
async function getPickupRoute(req, res) {
  try {
    const { shipmentId } = req.params;

    res.json({
      shipmentId,
      route: {
        origin: "Current Location",
        destination: "Farm Location",
        distance: "45 km",
        estimatedTime: "1 hour 15 minutes",
        directions: [
          "Head north on Highway 1",
          "Turn right on Farm Road 25",
          "Arrive at Green Valley Farm",
        ],
      },
    });
  } catch (err) {
    console.error("Error in getPickupRoute:", err);
    res.status(500).send({ error: err.message });
  }
}

// Confirm arrival at pickup location
async function confirmPickupLocation(req, res) {
  try {
    const { shipmentId } = req.params;
    const { location } = req.body;

    res.json({
      message: "Arrival at pickup location confirmed",
      shipmentId,
      location,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error in confirmPickupLocation:", err);
    res.status(500).send({ error: err.message });
  }
}

// ========================
// PERFORMANCE TRACKING
// ========================

// Get performance metrics
async function getPerformanceMetrics(req, res) {
  try {
    const { startDate, endDate } = req.query;

    let query = db
      .collection("transporterPerformance")
      .where("userId", "==", req.user.uid);

    if (startDate && endDate) {
      query = query.where("date", ">=", startDate).where("date", "<=", endDate);
    }

    const performanceSnapshot = await query.get();

    const performanceData = performanceSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const metrics = calculatePerformanceMetrics(performanceData);

    res.json({
      performance: performanceData,
      metrics,
      summary: {
        totalShifts: metrics.totalShifts,
        onTimePercentage: metrics.onTimePercentage,
        averageRating: metrics.averageRating,
        totalDeliveries: metrics.totalDeliveries,
      },
    });
  } catch (err) {
    console.error("Error in getPerformanceMetrics:", err);
    res.status(500).send({ error: err.message });
  }
}

// Helper function to calculate performance metrics
function calculatePerformanceMetrics(performanceData) {
  const totalRecords = performanceData.length;

  if (totalRecords === 0) {
    return {
      totalShifts: 0,
      totalDeliveries: 0,
      onTimePercentage: 0,
      averageRating: 0,
      totalHoursWorked: 0,
      averageDeliveryTime: 0,
    };
  }

  const shifts = performanceData.filter((record) => record.type === "shift");
  const deliveries = performanceData.filter(
    (record) => record.type === "delivery"
  );
  const arrivals = performanceData.filter(
    (record) => record.type === "arrival"
  );
  const pickups = performanceData.filter((record) => record.type === "pickup");

  const onTimeRecords = performanceData.filter(
    (record) => record.onTime === true
  );
  const onTimePercentage =
    totalRecords > 0 ? (onTimeRecords.length / totalRecords) * 100 : 0;

  const ratingsWithValues = deliveries.filter(
    (record) => record.customerRating && record.customerRating > 0
  );
  const averageRating =
    ratingsWithValues.length > 0
      ? ratingsWithValues.reduce(
          (sum, record) => sum + record.customerRating,
          0
        ) / ratingsWithValues.length
      : 0;

  const totalHoursWorked = shifts.reduce((total, shift) => {
    return total + (shift.hoursWorked || 0);
  }, 0);

  const deliveryTimes = deliveries.filter(
    (record) => record.minutesLate !== undefined
  );
  const averageDeliveryTime =
    deliveryTimes.length > 0
      ? deliveryTimes.reduce(
          (sum, record) => sum + (record.minutesLate || 0),
          0
        ) / deliveryTimes.length
      : 0;

  return {
    totalShifts: shifts.length,
    totalDeliveries: deliveries.length,
    totalArrivals: arrivals.length,
    totalPickups: pickups.length,
    onTimePercentage: parseFloat(onTimePercentage.toFixed(2)),
    averageRating: parseFloat(averageRating.toFixed(2)),
    totalHoursWorked: parseFloat(totalHoursWorked.toFixed(2)),
    averageDeliveryTime: parseFloat(averageDeliveryTime.toFixed(2)),
  };
}

// Helper function to get driver info by ID
async function getDriverInfo(driverId) {
  try {
    // Try deliverers collection first
    let driverDoc = await db.collection("deliverers").doc(driverId).get();

    if (driverDoc.exists) {
      const data = driverDoc.data();
      return {
        name: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
        contact: data.phone || data.email || "No contact info",
      };
    }

    // Try transporters collection
    driverDoc = await db.collection("transporters").doc(driverId).get();

    if (driverDoc.exists) {
      const data = driverDoc.data();
      return {
        name: data.name || "Unknown Driver",
        contact: data.phone || data.email || "No contact info",
      };
    }

    // Fallback to users collection
    driverDoc = await db.collection("users").doc(driverId).get();

    if (driverDoc.exists) {
      const data = driverDoc.data();
      return {
        name:
          `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
          "Unknown Driver",
        contact: data.phone || data.email || "No contact info",
      };
    }

    return {
      name: "Unknown Driver",
      contact: "No contact info",
    };
  } catch (error) {
    console.error("Error fetching driver info:", error);
    return {
      name: "Unknown Driver",
      contact: "No contact info",
    };
  }
}

// Get vehicle types from deliverers collection
async function getVehicleTypes(req, res) {
  try {
    console.log("Fetching vehicle types from deliverers collection...");

    // Query the deliverers collection
    const deliverersRef = db.collection("deliverers");
    const snapshot = await deliverersRef.get();

    // Extract unique vehicle types from extraFields
    const vehicleTypesSet = new Set();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();

      // Check both extraFields.vehicleType and direct vehicleType
      if (data.extraFields && data.extraFields.vehicleType) {
        vehicleTypesSet.add(data.extraFields.vehicleType);
      }
      if (data.vehicleType) {
        vehicleTypesSet.add(data.vehicleType);
      }
    });

    // Convert Set to Array and sort
    const vehicleTypes = Array.from(vehicleTypesSet).sort();

    console.log(
      `Found ${vehicleTypes.length} unique vehicle types:`,
      vehicleTypes
    );

    // If no vehicle types found, return default list
    if (vehicleTypes.length === 0) {
      const defaultTypes = [
        "Refrigerated Truck",
        "Box Truck",
        "Flatbed Truck",
        "Semi Truck",
        "Van",
      ];

      return res.json({
        vehicleTypes: defaultTypes,
        source: "default",
        message:
          "No vehicle types found in deliverers collection, using defaults",
      });
    }

    res.json({
      vehicleTypes,
      source: "deliverers_collection",
      count: vehicleTypes.length,
    });
  } catch (err) {
    console.error("Error fetching vehicle types:", err);
    res.status(500).send({ error: err.message });
  }
}

// ========================
// SCHEDULE MANAGEMENT - FIREBASE INTEGRATION
// ========================

// Get user's schedule from schedule_management collection
async function getUserSchedule(req, res) {
  try {
    const scheduleRef = db.collection("schedule_management").doc(req.user.uid);
    const scheduleDoc = await scheduleRef.get();

    if (!scheduleDoc.exists) {
      return res.json({
        weeklySchedule: {},
        standbyShifts: [],
        isMonthlyLocked: false,
      });
    }

    const scheduleData = scheduleDoc.data();

    // Lock monthly only if standbyShifts exist and have data
    const hasStandbyShifts =
      scheduleData.standbyShifts && scheduleData.standbyShifts.length > 0;

    res.json({
      weeklySchedule: scheduleData.weeklySchedule || {},
      standbyShifts: scheduleData.standbyShifts || [],
      isMonthlyLocked: hasStandbyShifts,
      message: hasStandbyShifts ? "Contact admin to make changes" : "",
    });
  } catch (err) {
    console.error("Error in getUserSchedule:", err);
    res.status(500).send({ error: err.message });
  }
}

// Save weekly schedule
async function saveWeeklySchedule(req, res) {
  try {
    const { weeklySchedule } = req.body;

    if (!weeklySchedule || typeof weeklySchedule !== "object") {
      return res.status(400).send({ error: "Invalid weekly schedule data" });
    }

    const scheduleRef = db.collection("schedule_management").doc(req.user.uid);

    await scheduleRef.set(
      {
        userId: req.user.uid,
        weeklySchedule: weeklySchedule,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    res.json({
      message: "Weekly schedule saved successfully",
      weeklySchedule: weeklySchedule,
    });
  } catch (err) {
    console.error("Error in saveWeeklySchedule:", err);
    res.status(500).send({ error: err.message });
  }
}

// Save monthly schedule (standby shifts)
async function saveMonthlySchedule(req, res) {
  try {
    const { standbyShifts } = req.body;

    // Check if user already has standby shifts saved
    const scheduleRef = db.collection("schedule_management").doc(req.user.uid);
    const scheduleDoc = await scheduleRef.get();

    if (scheduleDoc.exists) {
      const existingData = scheduleDoc.data();
      if (existingData.standbyShifts && existingData.standbyShifts.length > 0) {
        return res.status(403).json({
          error:
            "Monthly schedule already saved. Contact admin to make changes.",
        });
      }
    }

    const updateData = {
      userId: req.user.uid,
      standbyShifts: standbyShifts,
      updatedAt: new Date().toISOString(),
    };

    await scheduleRef.set(updateData, { merge: true });

    res.json({
      message: "Monthly schedule saved successfully",
      standbyShifts: standbyShifts,
    });
  } catch (err) {
    console.error("Error in saveMonthlySchedule:", err);
    res.status(500).send({ error: err.message });
  }
}

// ========================
// QR CODE VALIDATION
// ========================

// Temporary function for QR code validation
async function validateContainerQRCodes(req, res) {
  try {
    const { qrCodes } = req.body;

    if (!Array.isArray(qrCodes)) {
      return res
        .status(400)
        .send({ error: "QR codes must be an array of strings" });
    }

    // TODO:
    // - gets list of barcodes
    // - loops over the list and checks if all container are arrived
    // - if yes --> return true, else false

    // Temporary placeholder response
    res.json({
      message: "QR validation function placeholder",
      qrCodes: qrCodes,
      allContainersArrived: true,
      note: "Function implementation pending",
    });
  } catch (err) {
    console.error("Error in validateContainerQRCodes:", err);
    res.status(500).send({ error: err.message });
  }
}

// QR Code verification function for transporters
async function verifyShipmentQRCodes(req, res) {
  try {
    const { shipmentId } = req.params;
    const { scannedIds, shipmentType } = req.body; // Array of decoded QR code IDs + shipment type

    console.log(
      `[verifyShipmentQRCodes] Verifying QR codes for shipment: ${shipmentId}, type: ${shipmentType}`
    );
    console.log(`[verifyShipmentQRCodes] Scanned IDs:`, scannedIds);

    // Validate input
    if (!scannedIds || !Array.isArray(scannedIds) || scannedIds.length === 0) {
      return res.status(400).json({
        error: "scannedIds must be a non-empty array",
      });
    }

    // Determine the correct collection based on shipment type
    let collectionName;
    if (shipmentType === "farmer_shipment") {
      collectionName = "farmer_shipments";
    } else if (shipmentType === "customer_shipment") {
      collectionName = "customer_shipments";
    } else {
      // Default fallback - try farmer_shipments first, then customer_shipments
      collectionName = "farmer_shipments";
    }

    console.log(
      `[verifyShipmentQRCodes] Looking in collection: ${collectionName}`
    );

    // Get the shipment document
    let shipmentRef = db.collection(collectionName).doc(shipmentId);
    let shipmentDoc = await shipmentRef.get();

    // If not found in the primary collection, try the other collection
    if (!shipmentDoc.exists && !shipmentType) {
      console.log(
        `[verifyShipmentQRCodes] Not found in ${collectionName}, trying customer_shipments`
      );
      collectionName = "customer_shipments";
      shipmentRef = db.collection(collectionName).doc(shipmentId);
      shipmentDoc = await shipmentRef.get();
    }

    if (!shipmentDoc.exists) {
      console.log(
        `[verifyShipmentQRCodes] Shipment ${shipmentId} not found in any collection`
      );
      return res.status(404).json({
        error: "Shipment not found",
      });
    }

    const shipmentData = shipmentDoc.data();
    console.log(
      `[verifyShipmentQRCodes] Found shipment in ${collectionName}, status: ${shipmentData.status}`
    );

    // Check if shipment status is "arrived"
    if (shipmentData.status !== "arrived") {
      return res.status(400).json({
        error:
          "QR codes can only be verified for shipments with status 'Arrived'",
      });
    }

    // Check if the transporter is authorized for this shipment
    if (shipmentData.driver !== req.user.uid) {
      return res.status(403).json({
        error: "Not authorized to verify QR codes for this shipment",
      });
    }

    // Prepare expected IDs: shipment ID + all container codes
    const expectedIds = [shipmentId]; // The shipment ID itself
    const containers = shipmentData.containers || [];

    // Add container codes to expected IDs
    containers.forEach((container) => {
      if (container.code) {
        expectedIds.push(container.code);
      }
    });

    console.log(`[verifyShipmentQRCodes] Expected IDs:`, expectedIds);

    // Check if all expected IDs are present in scanned IDs
    const missingIds = expectedIds.filter((id) => !scannedIds.includes(id));
    const extraIds = scannedIds.filter((id) => !expectedIds.includes(id));

    // Verify each scanned ID
    const verificationResults = scannedIds.map((scannedId) => {
      if (scannedId === shipmentId) {
        return {
          id: scannedId,
          type: "shipment",
          valid: true,
          message: "Shipment ID verified",
        };
      } else {
        const container = containers.find((c) => c.code === scannedId);
        if (container) {
          return {
            id: scannedId,
            type: "container",
            valid: true,
            message: `Container ${scannedId} verified`,
          };
        } else {
          return {
            id: scannedId,
            type: "unknown",
            valid: false,
            message: `ID ${scannedId} does not belong to this shipment`,
          };
        }
      }
    });

    // Determine overall verification status
    const allValid = verificationResults.every((result) => result.valid);
    const allExpectedPresent = missingIds.length === 0;
    const noExtraIds = extraIds.length === 0;

    const verificationPassed = allValid && allExpectedPresent && noExtraIds;

    // Prepare response
    const response = {
      shipmentId,
      verificationPassed,
      totalExpected: expectedIds.length,
      totalScanned: scannedIds.length,
      verificationResults,
      summary: {
        validIds: verificationResults.filter((r) => r.valid).length,
        invalidIds: verificationResults.filter((r) => !r.valid).length,
        missingIds: missingIds,
        extraIds: extraIds,
      },
    };

    // If verification passed, update shipment status to "Verified"
    if (verificationPassed) {
      await shipmentRef.update({
        status: "Verified",
        qrVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        qrVerifiedBy: req.user.uid,
        qrVerificationResults: response,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      response.message =
        "All QR codes verified successfully. Shipment status updated to 'Verified'.";
    } else {
      response.message =
        "QR code verification failed. Please check the results and scan missing codes.";
    }

    console.log(`[verifyShipmentQRCodes] Verification result:`, response);

    res.json(response);
  } catch (error) {
    console.error("Error in verifyShipmentQRCodes:", error);
    res.status(500).json({
      error: "Failed to verify QR codes",
      details: error.message,
    });
  }
}

async function calculateBoxVolume(req, res) {
  try {
    const { l, w, h } = req.body;

    // Validate input parameters
    if (!l || !w || !h) {
      return res.status(400).send({
        error: "l, w, and h are required",
      });
    }

    // Calculate volume
    const volume = l * w * h;

    res.json({ volume });
  } catch (err) {
    console.error("Error in calculateBoxVolume:", err);
    res.status(500).send({ error: err.message });
  }
}

module.exports = {
  upsertTransporterProfile,
  getMyTransporterProfile,
  listAvailableShipments,
  acceptShipment,
  getMyShipments,
  updateShipmentStatus,
  getAvailableShifts,
  getMonthlySchedule,
  updateMonthlyScheduleDate,
  updateStandbyShifts,
  logArrival,
  getPickupNotifications,
  getPickupLocation,
  confirmPickup,
  getDeliveryRoute,
  confirmDelivery,
  getAvailablePickups,
  startShift,
  getDepartureAlerts,
  getPickupRoute,
  confirmPickupLocation,
  getPerformanceMetrics,
  getDriverInfo,
  getVehicleTypes,
  getUserSchedule,
  saveWeeklySchedule,
  saveMonthlySchedule,
  validateContainerQRCodes,
  calculateBoxVolume,
  verifyShipmentQRCodes,
};
