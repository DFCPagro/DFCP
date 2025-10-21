// src/services/jobApplication.helpers.ts
import type { ClientSession, Types } from "mongoose";
import { JobApplicationBase } from "../models/jobApplication.model";
import { Farmer } from "../models/farmer.model";
import { FarmerLand } from "../models/farmerLand.model";
import { Deliverer } from "../models/deliverer.model";
import { IndustrialDeliverer } from "../models/IndustrialDeliverer.model";
import { User } from "../models/user.model";

/** Utility: days in a given month (from any date within that month). */
function daysInMonth(d: Date): number {
  const y = d.getFullYear();
  const m = d.getMonth();
  return new Date(y, m + 1, 0).getDate();
}

/** Utility: first day of the month (truncate time). */
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Convert a weekly 7-length bitmask (Sun..Sat) into a monthly
 * activeSchedule array for the specific month (length = days in month).
 * Each day inherits the bitmask of its weekday.
 *
 * weekly[i] ∈ [0..15] if you're using 4 shifts/day, but we don't clamp here;
 * validation should already be done at the model/validator layer.
 */
export function mapWeeklyToMonthlyActiveSchedule(
  weekly: number[] | undefined,
  monthDate: Date
): number[] {
  const weeklySafe =
    Array.isArray(weekly) && weekly.length === 7
      ? weekly
      : [0, 0, 0, 0, 0, 0, 0];
  const start = startOfMonth(monthDate);
  const dim = daysInMonth(start);
  const out: number[] = new Array(dim);

  for (let day = 1; day <= dim; day++) {
    const d = new Date(start.getFullYear(), start.getMonth(), day);
    const weekday = d.getDay(); // 0=Sun .. 6=Sat
    out[day - 1] = weeklySafe[weekday] ?? 0;
  }
  return out;
}

/**
 * Best-effort area calculator (m^2) from "measurements".
 * We intentionally keep this tolerant because "measurements" schema
 * can vary by UI; if we can't compute, return null and let the real Land
 * validator accept it (if optional) or service reject with a clear message.
 */
// services/jobApplication.helpers.ts

export function computeAreaM2FromMeasurements(
  measurements: any
): number | null {
  if (!measurements || typeof measurements !== "object") return null;

  // 0) FE shape you use on farmer lands: { abM, bcM, cdM, daM, rotationDeg }
  if (
    typeof measurements.abM === "number" &&
    typeof measurements.bcM === "number" &&
    typeof measurements.cdM === "number" &&
    typeof measurements.daM === "number"
  ) {
    const { abM, bcM, cdM, daM } = measurements;
    const eps = 1e-6;
    // rectangle-ish if opposite sides match
    const rect =
      Math.abs(abM - cdM) < eps &&
      Math.abs(bcM - daM) < eps &&
      abM > 0 &&
      bcM > 0;
    const area = rect ? abM * bcM : abM * bcM; // fall back to abM×bcM estimate
    return Number.isFinite(area) && area > 0 ? area : null;
  }

  // 1) { lengthM, widthM }
  if (
    typeof measurements.lengthM === "number" &&
    typeof measurements.widthM === "number"
  ) {
    const area = measurements.lengthM * measurements.widthM;
    return Number.isFinite(area) && area > 0 ? area : null;
  }

  // 2) { length, width, unit?: "m" | "meter" }
  if (
    typeof measurements.length === "number" &&
    typeof measurements.width === "number" &&
    (measurements.unit === "m" ||
      measurements.unit === "meter" ||
      !measurements.unit)
  ) {
    const area = measurements.length * measurements.width;
    return Number.isFinite(area) && area > 0 ? area : null;
  }

  // 3) Polygon points [{x,y}]
  if (Array.isArray(measurements.points) && measurements.points.length >= 3) {
    const pts = measurements.points;
    if (
      pts.every(
        (p: any) => typeof p?.x === "number" && typeof p?.y === "number"
      )
    ) {
      let sum = 0;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
      }
      const area = Math.abs(sum / 2);
      return Number.isFinite(area) && area > 0 ? area : null;
    }
  }

  return null;
}

/** Promote the user's role to the approved worker role (single-role model). */
export async function promoteUserRole(params: {
  userId: Types.ObjectId | string;
  role: "farmer" | "deliverer" | "industrialDeliverer";
  logisticsCenterId: Types.ObjectId | string; // NEW
  session: ClientSession;
}): Promise<void> {
  const { userId, role, logisticsCenterId, session } = params;

  await User.findByIdAndUpdate(
    userId,
    { $set: { role, logisticsCenterId } }, // add logisticsCenterId
    {
      session,
      new: false,
      strict: false,
      runValidators: true, // (recommended) respect schema validation
    }
  ).lean(false);
}

/** Map base application logisticCenterId to worker's logisticCenterIds array. */
function mapLogisticCenterToArray(lcId?: string | null): string[] {
  return lcId ? [lcId] : [];
}

/** Provision Farmer + FarmerLand(s) from an approved application. */
// services/jobApplication.helpers.ts

export async function provisionFarmer(params: {
  app: JobApplicationBase & { appliedRole: "farmer"; applicationData: any };
  session: ClientSession;
}): Promise<{ farmer: any; lands: any[] }> {
  const { app, session } = params;
  const data = app.applicationData || {};
  const landsInput = Array.isArray(data.lands) ? data.lands : [];

  if (landsInput.length < 1) {
    throw new Error("Farmer application must include at least one land.");
  }

  // Pre-allocate a farmer _id so lands can reference it
  const farmerId = new (require("mongoose").Types.ObjectId)();

  // Build land docs first (compute required areaM2; throw if we can't)
  const landDocsPayload = landsInput.map((l: any, idx: number) => {
    const areaM2 = computeAreaM2FromMeasurements(l.measurements);
    if (areaM2 == null) {
      throw new Error(
        `Cannot compute areaM2 for land #${idx + 1} (${
          l?.name ?? "unnamed"
        }). Check measurements.`
      );
    }
    return {
      farmer: farmerId,
      name: l.name,
      ownership: l.ownership, // "owned" | "rented"
      address: l.address,
      pickupAddress: l.pickupAddress ?? null,
      measurements: l.measurements,
      areaM2,
      sections: [],
    };
  });

  // Insert lands
  const insertedLands = await FarmerLand.insertMany(landDocsPayload, {
    session,
  });

  // Now create Farmer WITH lands already set (so validator passes)
  const farmer = await Farmer.create(
    [
      {
        _id: farmerId,
        user: app.user,
        farmName: data.farmName,
        agriculturalInsurance: !!data.agriculturalInsurance,
        agreementPercentage:
          typeof data.agreementPercentage === "number"
            ? data.agreementPercentage
            : undefined,
        // If your Farmer schema doesn’t have logisticCenterIds (it currently doesn’t), this field is ignored by strict mode
        logisticCenterIds: (app as any).logisticCenterId
          ? [(app as any).logisticCenterId]
          : [],
        lands: insertedLands.map((d) => d._id),
      },
    ],
    { session }
  ).then((arr) => arr[0]);

  return { farmer, lands: insertedLands };
}

/** Provision Deliverer from an approved application (non-industrial). */
export async function provisionDeliverer(params: {
  app: JobApplicationBase & { appliedRole: "deliverer"; applicationData: any };
  session: ClientSession;
  now?: Date; // allow testing / deterministic month
}): Promise<{ deliverer: any }> {
  const { app, session } = params;
  const data = app.applicationData || {};
  const now = params.now ?? new Date();
  // Use Date for schedule mapping
  const monthStart = startOfMonth(now);
  const activeSchedule = mapWeeklyToMonthlyActiveSchedule(
    data.weeklySchedule,
    monthStart
  );

  // Use 1..12 number for the model field
  const currentMonthNum = now.getMonth() + 1;

  const existing = await Deliverer.findOne({ user: app.user }).session(session);
  if (existing) return { deliverer: existing };

  const deliverer = await Deliverer.create(
    [
      {
        user: app.user,
        // createdFromApplication: app.id,
        // license / id
        licenseType: data.licenseType,
        driverLicenseNumber: data.driverLicenseNumber,

        // vehicle basics
        vehicleMake: data.vehicleMake,
        vehicleModel: data.vehicleModel,
        vehicleType: data.vehicleType,
        vehicleYear: data.vehicleYear,
        vehicleRegistrationNumber: data.vehicleRegistrationNumber,

        // boolean in schema; accept either boolean or number from FE
        vehicleInsurance: !!data.vehicleInsurance,

        // capacities
        vehicleCapacityKg: data.vehicleCapacityKg,
        vehicleCapacityLiters: data.vehicleCapacityLiters,
        speedKmH: data.speedKmH,

        // cargo dims: accept either vehicleCargoCM or cargoDimensions
        vehicleCargoCM: data.vehicleCargoCM ?? data.cargoDimensions,

        // pay
        payFixedPerShift: data.payFixedPerShift,
        payPerKm: data.payPerKm,
        payPerStop: data.payPerStop,

        // centers
        logisticCenterIds: (app as any).logisticCenterId
          ? [(app as any).logisticCenterId]
          : [],

        // schedules
        currentMonth: currentMonthNum, // <-- number (1..12)
        activeSchedule,
      },
    ],
    { session }
  ).then((arr) => arr[0]);

  return { deliverer };
}

/** Provision Industrial Deliverer (same as Deliverer + refrigerated). */
export async function provisionIndustrialDeliverer(params: {
  app: JobApplicationBase & {
    appliedRole: "industrialDeliverer";
    applicationData: any;
  };
  session: ClientSession;
  now?: Date;
}): Promise<{ industrialDeliverer: any }> {
  const { app, session } = params;
  const data = app.applicationData || {};
  const now = params.now ?? new Date();
  const currentMonth = startOfMonth(now);
  const activeSchedule = mapWeeklyToMonthlyActiveSchedule(
    data.weeklySchedule,
    currentMonth
  );

  // Idempotency by uniqueness: reuse if exists
  const existing = await IndustrialDeliverer.findOne({
    user: app.user,
  }).session(session);
  if (existing) {
    return { industrialDeliverer: existing };
  }

  const industrialDeliverer = await IndustrialDeliverer.create(
    [
      {
        user: app.user,

        // License / ID
        licenseType: data.licenseType,
        driverLicenseNumber: data.driverLicenseNumber,

        // Vehicle basics
        vehicleMake: data.vehicleMake,
        vehicleModel: data.vehicleModel,
        vehicleType: data.vehicleType,
        vehicleYear: data.vehicleYear,
        vehicleRegistrationNumber: data.vehicleRegistrationNumber,
        vehicleInsuranceNumber: data.vehicleInsuranceNumber,

        // Capacities / performance
        vehicleCapacityKg: data.vehicleCapacityKg,
        vehicleCapacityLiters: data.vehicleCapacityLiters,
        speedKmH: data.speedKmH,

        // Cargo dims (required at application)
        vehicleCargoCM: data.vehicleCargoCM,

        // Pay
        payFixedPerShift: data.payFixedPerShift,
        payPerKm: data.payPerKm,
        payPerStop: data.payPerStop,

        // Industrial flag
        refrigerated: !!data.refrigerated,

        // Region/center mapping
        logisticCenterIds: mapLogisticCenterToArray(
          (app as any).logisticCenterId
        ),

        // Schedules (derived monthly)
        currentMonth,
        activeSchedule,
      },
    ],
    { session }
  ).then((arr) => arr[0]);

  return { industrialDeliverer };
}
