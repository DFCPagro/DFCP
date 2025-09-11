// services/promotion.service.ts
import mongoose from "mongoose";
import { JobApplication } from "../models/jobApplication.model";
import {
  FarmerApplicationDoc,
  DelivererApplicationDoc,
  IndustrialDelivererApplicationDoc,
  JobApplicationBaseDoc,
} from "../models/jobApplication.model";
import { Farmer } from "../models/farmer.model";
import { FarmerLand } from "../models/farmerLand.model";
import { FarmerSection } from "../models/farmerSection.model";
import { Deliverer } from "../models/deliverer.model";


/* =========================
 * Helpers
 * ======================= */

// Ensure a default LC if not provided (business rule)
function ensureLC<T extends { logisticCenterId?: string | null }>(addr: T | null | undefined): T | null {
  if (!addr) return null;
  return { ...addr, logisticCenterId: addr.logisticCenterId ?? "LC-1" };
}

// Best-effort area from measurements (rectangle-ish fallback)
function computeAreaM2FromMeasurements(meas?: {
  abM?: number; bcM?: number; cdM?: number; daM?: number;
}): number | null {
  if (!meas) return null;
  const { abM = 0, bcM = 0 } = meas;
  if (abM <= 0 || bcM <= 0) return null;
  return abM * bcM; // if not exact rectangle, still a reasonable UI fallback
}

/* =========================
 * Farmer Promotion
 * ======================= */

type PromoteFarmerOptions = {
  createDefaultSectionPerLand?: boolean; // default false
  defaultSectionAgreementKg?: number;    // used only if creating sections
};

export async function promoteFarmerApplication(
  app: FarmerApplicationDoc,
  opts: PromoteFarmerOptions = {}
) {
  const { createDefaultSectionPerLand = false, defaultSectionAgreementKg = 0 } = opts;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1) Create lands from application data
    const landDocs = await FarmerLand.insertMany(
      app.applicationData.lands.map((land) => ({
        farmer: null, // patched after farmer is created
        name: land.name,
        ownership: land.ownership,

        // copy shapes; ensure LC default "LC-1"
        address: ensureLC(land.address)!,
        pickupAddress: ensureLC(land.pickupAddress),

        measurements: { ...land.measurements },
        areaM2:
          typeof land.areaM2 === "number" && land.areaM2 >= 0
            ? land.areaM2
            : computeAreaM2FromMeasurements(land.measurements) ?? 0,

        sections: [],
      })),
      { session }
    );

    // 2) Optionally create 1 empty section per land
    let sectionIdsByLand: Record<string, mongoose.Types.ObjectId[]> = {};
    if (createDefaultSectionPerLand) {
      const sectionDocs = await FarmerSection.insertMany(
        landDocs.map((ld) => ({
          land: ld._id,
          measurements: { ...ld.measurements }, // mirror land shape for simple UI start
          crops: [],
          logisticCenterId: ld.address?.logisticCenterId ?? "LC-1",
          agreementAmountKg: defaultSectionAgreementKg,
        })),
        { session }
      );

      // Group sections by land
      sectionIdsByLand = sectionDocs.reduce((acc, s) => {
        const key = String(s.land);
        (acc[key] = acc[key] || []).push(s._id);
        return acc;
      }, {} as Record<string, mongoose.Types.ObjectId[]>);

      // Patch sections into lands
      await Promise.all(
        landDocs.map((ld) =>
          FarmerLand.updateOne(
            { _id: ld._id },
            { $set: { sections: sectionIdsByLand[String(ld._id)] || [] } },
            { session }
          )
        )
      );
    }

    // 3) Create farmer
    const [farmer] = await Farmer.create(
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
    );

    // 4) Patch farmer reference back into lands
    await FarmerLand.updateMany(
      { _id: { $in: landDocs.map((l) => l._id) } },
      { $set: { farmer: farmer._id } },
      { session }
    );

    // 5) Mark application as accepted (idempotent if already accepted)
    await JobApplication.updateOne(
      { _id: app._id },
      { $set: { status: "accepted" } },
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

/* =========================
 * Deliverer Promotion
 * ======================= */

export async function promoteDelivererApplication(app: DelivererApplicationDoc) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Create deliverer from application
    const [deliverer] = await Deliverer.create(
      [
        {
          user: app.user,
          createdFromApplication: app._id,
          logisticCenterIds: app.logisticCenterId ? [app.logisticCenterId] : [],
          // applicationData already matches Deliverer fields you defined (license/vehicle/pay/weeklySchedule)
          ...app.applicationData,
        },
      ],
      { session }
    );

    await JobApplication.updateOne(
      { _id: app._id },
      { $set: { status: "accepted" } },
      { session }
    );

    await session.commitTransaction();
    return deliverer;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/* =========================
 * Industrial Deliverer Promotion
 * ======================= */



/* =========================
 * Convenience entry point (optional)
 * ======================= */

export async function promoteIfAccepted(doc: JobApplicationBaseDoc) {
  // Call this from updateStatus *after* you normalize and set status to "accepted"
  switch (doc.appliedRole) {
    case "farmer":
      return promoteFarmerApplication(doc as unknown as FarmerApplicationDoc);
    case "deliverer":
      return promoteDelivererApplication(doc as unknown as DelivererApplicationDoc);

    // picker/sorter: no profile by default; create as needed
    default:
      return null;
  }
}
