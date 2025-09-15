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
  const weeklySafe = Array.isArray(weekly) && weekly.length === 7 ? weekly : [0, 0, 0, 0, 0, 0, 0];
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
export function computeAreaM2FromMeasurements(measurements: any): number | null {
  if (!measurements || typeof measurements !== "object") return null;

  // Common rectangle conventions we’ve seen:
  // 1) { lengthM: number, widthM: number }
  if (typeof measurements.lengthM === "number" && typeof measurements.widthM === "number") {
    const area = measurements.lengthM * measurements.widthM;
    return Number.isFinite(area) && area > 0 ? area : null;
  }

  // 2) { length: number, width: number, unit: "m" | "meter" }
  if (
    typeof measurements.length === "number" &&
    typeof measurements.width === "number" &&
    (measurements.unit === "m" || measurements.unit === "meter" || !measurements.unit)
  ) {
    const area = measurements.length * measurements.width;
    return Number.isFinite(area) && area > 0 ? area : null;
  }

  // 3) Polygon with points (rough shoelace if provided as [{x,y}] in meters)
  if (Array.isArray(measurements.points) && measurements.points.length >= 3) {
    const pts = measurements.points;
    if (pts.every((p: any) => typeof p?.x === "number" && typeof p?.y === "number")) {
      let sum = 0;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
      }
      const area = Math.abs(sum / 2);
      return Number.isFinite(area) && area > 0 ? area : null;
    }
  }

  // Couldn’t infer
  return null;
}

/** Promote the user's role to the approved worker role (single-role model). */
export async function promoteUserRole(params: {
  userId: Types.ObjectId | string;
  role: "farmer" | "deliverer" | "industrialDeliverer";
  session: ClientSession;
}): Promise<void> {
  const { userId, role, session } = params;
  await User.findByIdAndUpdate(
    userId,
    { $set: { role } },
    { session, new: false, strict: false }
  ).lean(false);
}

/** Map base application logisticCenterId to worker's logisticCenterIds array. */
function mapLogisticCenterToArray(lcId?: string | null): string[] {
  return lcId ? [lcId] : [];
}

/** Provision Farmer + FarmerLand(s) from an approved application. */
export async function provisionFarmer(params: {
  app: JobApplicationBase & { appliedRole: "farmer"; applicationData: any };
  session: ClientSession;
}): Promise<{ farmer: any; lands: any[] }> {
  const { app, session } = params;
  const data = app.applicationData || {};
  const lands = Array.isArray(data.lands) ? data.lands : [];

  if (lands.length < 1) {
    throw new Error("Farmer application must include at least one land.");
  }

  // Create Farmer first
  const farmer = await Farmer.create(
    [
      {
        user: app.user,
        farmName: data.farmName,
        agriculturalInsurance: !!data.agriculturalInsurance,
        agreementPercentage: typeof data.agreementPercentage === "number" ? data.agreementPercentage : undefined,
        // If your Farmer model stores logisticCenterIds, map it; otherwise ignore
        logisticCenterIds: mapLogisticCenterToArray((app as any).logisticCenterId),
      },
    ],
    { session }
  ).then((arr) => arr[0]);

  // Create FarmerLand(s)
  const landDocs = await FarmerLand.insertMany(
    lands.map((l: any) => {
      const areaM2 = computeAreaM2FromMeasurements(l.measurements);
      return {
        farmer: farmer._id,
        name: l.name,
        ownership: l.ownership, // "owned" | "rented"
        address: l.address,
        pickupAddress: l.pickupAddress ?? null,
        measurements: l.measurements,
        // If FarmerLand requires areaM2: ensure it’s set; otherwise pass null
        areaM2: areaM2 ?? null,
        sections: [], // default; can be filled later by ops
      };
    }),
    { session }
  );

  // Backlink from Farmer to lands if your schema expects it
  try {
    await Farmer.findByIdAndUpdate(
      farmer._id,
      { $set: { lands: landDocs.map((d) => d._id) } },
      { session }
    );
  } catch {
    // If Farmer doesn't have a "lands" array, this update will be a no-op
  }

  return { farmer, lands: landDocs };
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
  const currentMonth = startOfMonth(now);
  const activeSchedule = mapWeeklyToMonthlyActiveSchedule(data.weeklySchedule, currentMonth);

  // Idempotency by uniqueness: reuse if exists
  const existing = await Deliverer.findOne({ user: app.user }).session(session);
  if (existing) {
    // Optionally refresh schedule/currentMonth on re-approve, but most flows return early
    return { deliverer: existing };
  }

  const deliverer = await Deliverer.create(
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

        // Region/center mapping
        logisticCenterIds: mapLogisticCenterToArray((app as any).logisticCenterId),

        // Schedules (derived monthly)
        currentMonth,
        activeSchedule,
      },
    ],
    { session }
  ).then((arr) => arr[0]);

  return { deliverer };
}

/** Provision Industrial Deliverer (same as Deliverer + refrigerated). */
export async function provisionIndustrialDeliverer(params: {
  app: JobApplicationBase & { appliedRole: "industrialDeliverer"; applicationData: any };
  session: ClientSession;
  now?: Date;
}): Promise<{ industrialDeliverer: any }> {
  const { app, session } = params;
  const data = app.applicationData || {};
  const now = params.now ?? new Date();
  const currentMonth = startOfMonth(now);
  const activeSchedule = mapWeeklyToMonthlyActiveSchedule(data.weeklySchedule, currentMonth);

  // Idempotency by uniqueness: reuse if exists
  const existing = await IndustrialDeliverer.findOne({ user: app.user }).session(session);
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
        logisticCenterIds: mapLogisticCenterToArray((app as any).logisticCenterId),

        // Schedules (derived monthly)
        currentMonth,
        activeSchedule,
      },
    ],
    { session }
  ).then((arr) => arr[0]);

  return { industrialDeliverer };
}
