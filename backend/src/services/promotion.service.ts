// services/promotion.service.ts
import mongoose from "mongoose";
import { JobApplicationBaseDoc, FarmerApplicationDoc, DelivererApplicationDoc } from "../models/jobApplication.model";
import { Farmer } from "../models/farmer.model";
import { FarmerLand } from "../models/farmerLand.model";
import { FarmerSection } from "../models/farmerSection.model";
import { Deliverer } from "../models/deliverer.model";

/**
 * Promote a Farmer job application into Farmer + Lands (+ Sections)
 */
export async function promoteFarmerApplication(app: FarmerApplicationDoc) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create lands from applicationData
    const landDocs = await FarmerLand.insertMany(
      app.applicationData.lands.map((land) => ({
        farmer: null, // patched after Farmer is created
        name: land.name,
        ownership: land.ownership,
        widthM: land.acres ?? 0, // map acres → widthM or adjust logic
        lengthM: 0,
        landLocation: land.pickupAddress
          ? {
              lnt: land.pickupAddress.longitude ?? 0,
              alt: land.pickupAddress.latitude ?? 0,
              address: land.pickupAddress.address,
              logisticCenterId: "LC-1",
            }
          : null,
        pickUpLocation: land.pickupAddress
          ? {
              lnt: land.pickupAddress.longitude ?? 0,
              alt: land.pickupAddress.latitude ?? 0,
              address: land.pickupAddress.address,
              logisticCenterId: "LC-1",
            }
          : null,
        sections: [],
      })),
      { session }
    );

    // Create farmer
    const farmer = await Farmer.create(
      [
        {
          user: app.user,
          agriculturalInsurance: app.applicationData.agriculturalInsurance ?? false,
          farmName: app.applicationData.farmName,
          agreementPercentage: app.applicationData.agreementPercentage ?? 60,
          lands: landDocs.map((l) => l._id),
        },
      ],
      { session }
    ).then((arr) => arr[0]);

    // Patch farmer reference into lands
    await FarmerLand.updateMany(
      { _id: { $in: landDocs.map((l) => l._id) } },
      { $set: { farmer: farmer._id } },
      { session }
    );

    await session.commitTransaction();
    return farmer;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Promote a Deliverer job application into Deliverer profile
 */
export async function promoteDelivererApplication(app: DelivererApplicationDoc) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const deliverer = await Deliverer.create(
      [
        {
          user: app.user,
          createdFromApplication: app._id,
          logisticCenterIds: app.logisticCenterId ? [app.logisticCenterId] : [],
          ...app.applicationData,
        },
      ],
      { session }
    ).then((arr) => arr[0]);

    await session.commitTransaction();
    return deliverer;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}
