import mongoose from "mongoose";
import { FilterQuery, ProjectionType, QueryOptions, UpdateQuery } from "mongoose";
import { Deliverer } from "../models/deliverer.model";
import LogisticsCenter from "../models/logisticsCenter.model";
import ApiError from "../utils/ApiError";

export type ListDeliverersParams = {
  page?: number;
  limit?: number;
  sort?: string; // e.g. "-createdAt" or "vehicleMake"
  user?: string;
  logisticCenterId?: string;
  currentMonth?: number;
  hasVehicleInsurance?: boolean;
  licenseType?: string;
  search?: string; // searches vehicle fields + driverLicenseNumber
};

const safeInt = (v: any, def: number) => (Number.isFinite(+v) && +v > 0 ? +v : def);

export const createDeliverer = async (payload: Partial<InstanceType<typeof Deliverer>>) => {
  const doc = await Deliverer.create(payload as any);
  return doc;
};

export const getDelivererById = async (id: string, projection?: ProjectionType<any>) => {
  const doc = await Deliverer.findById(id, projection);
  if (!doc) throw new ApiError(404, "Deliverer not found");
  return doc;
};

export const getDelivererByUserId = async (userId: string) => {
  const doc = await Deliverer.findOne({ user: userId });
  if (!doc) throw new ApiError(404, "Deliverer for user not found");
  return doc;
};

export const listDeliverers = async (params: ListDeliverersParams = {}) => {
  const {
    page = 1,
    limit = 20,
    sort = "-createdAt",
    user,
    logisticCenterId,
    currentMonth,
    hasVehicleInsurance,
    licenseType,
    search,
  } = params;

  const filter: FilterQuery<typeof Deliverer> = {};
  if (user) filter.user = user;
  if (logisticCenterId) filter.logisticCenterIds = { $in: [logisticCenterId] };
  if (typeof currentMonth === "number") filter.currentMonth = currentMonth;
  if (typeof hasVehicleInsurance === "boolean") filter.vehicleInsurance = hasVehicleInsurance;
  if (licenseType) filter.licenseType = licenseType;

  if (search && search.trim()) {
    const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    Object.assign(filter, {
      $or: [
        { vehicleMake: rx },
        { vehicleModel: rx },
        { vehicleType: rx },
        { vehicleRegistrationNumber: rx },
        { driverLicenseNumber: rx },
      ],
    });
  }

  const pageNum = safeInt(page, 1);
  const limitNum = Math.min(safeInt(limit, 20), 100);

  const [items, total] = await Promise.all([
    Deliverer.find(filter)
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Deliverer.countDocuments(filter),
  ]);

  return {
    items,
    page: pageNum,
    limit: limitNum,
    total,
    pages: Math.ceil(total / limitNum) || 1,
  };
};

export const updateDeliverer = async (id: string, update: UpdateQuery<any>, options: QueryOptions = {}) => {
  const doc = await Deliverer.findByIdAndUpdate(id, update, { new: true, runValidators: true, ...options });
  if (!doc) throw new ApiError(404, "Deliverer not found");
  return doc;
};

export const deleteDeliverer = async (id: string) => {
  const doc = await Deliverer.findByIdAndDelete(id);
  if (!doc) throw new ApiError(404, "Deliverer not found");
  return { success: true };
};

// ===== schedule utilities =====

/** Replace the entire activeSchedule (validated by schema hooks) */
export const setActiveSchedule = async (id: string, activeSchedule: number[]) => {
  return updateDeliverer(id, { $set: { activeSchedule } });
};

/** Replace the entire nextSchedule (validated by schema) */
export const setNextSchedule = async (id: string, nextSchedule: number[]) => {
  return updateDeliverer(id, { $set: { nextSchedule } });
};

/** Toggle or set specific day&mask in activeSchedule */
export const setDayShift = async (id: string, dayIndex: number, shiftMask: number, enabled: boolean) => {
  const doc = await getDelivererById(id);
  if (dayIndex < 0 || dayIndex >= doc.activeSchedule.length) {
    throw new ApiError(400, "dayIndex out of range for currentMonth");
  }
  if (!Number.isInteger(shiftMask) || shiftMask < 0 || shiftMask > 15) {
    throw new ApiError(400, "shiftMask must be an integer within [0..15]");
  }

  const dayMask = doc.activeSchedule[dayIndex] ?? 0;
  const newMask = enabled ? (dayMask | shiftMask) : (dayMask & ~shiftMask & 0b1111);
  doc.activeSchedule[dayIndex] = newMask;
  await doc.save();
  return doc;
};

export const checkAvailability = async (id: string, dayIndex: number, shiftMask: number) => {
  const doc = await getDelivererById(id);
  const available = doc.isAvailable(dayIndex, shiftMask);
  return { available };
};

/**
 * Advance currentMonth (1..12). If applyNext=true and nextSchedule present,
 * it becomes the new activeSchedule and nextSchedule is cleared.
 * Otherwise, activeSchedule resets via the model's pre('findOneAndUpdate') hook.
 */
export const advanceMonth = async (id: string, applyNext: boolean) => {
  const doc = await getDelivererById(id);
  const newMonth = ((doc.currentMonth % 12) + 1);

  if (applyNext && Array.isArray(doc.nextSchedule) && doc.nextSchedule.length > 0) {
    const updated = await updateDeliverer(id, {
      $set: {
        currentMonth: newMonth,
        activeSchedule: doc.nextSchedule,
        nextSchedule: [],
      },
    });
    return updated;
  }

  // Let the schema hook reset activeSchedule to zeros for the new month
  const updated = await updateDeliverer(id, {
    $set: { currentMonth: newMonth, nextSchedule: [] },
    // no activeSchedule => pre('findOneAndUpdate') will zero it for the new month
  });
  return updated;
};


/** Return centers assigned to this deliverer (lean) */
export const listCentersForDeliverer = async (delivererId: string) => {
  const d = await Deliverer.findById(delivererId, { logisticCenterIds: 1, user: 1 }).lean();
  if (!d) throw new ApiError(404, "Deliverer not found");
  const centers = await LogisticsCenter.find({ _id: { $in: d.logisticCenterIds } }).lean();
  return centers;
};

/** Assign deliverer to a center and ensure LC.employeeIds includes the deliverer.user */
export const assignDelivererToCenter = async (delivererId: string, centerId: string) => {
  if (!mongoose.isValidObjectId(delivererId) || !mongoose.isValidObjectId(centerId)) {
    throw new ApiError(400, "Invalid id(s)");
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const d = await Deliverer.findByIdAndUpdate(
      delivererId,
      { $addToSet: { logisticCenterIds: new mongoose.Types.ObjectId(centerId) } },
      { new: true, session }
    );
    if (!d) throw new ApiError(404, "Deliverer not found");

    await LogisticsCenter.findByIdAndUpdate(
      centerId,
      { $addToSet: { employeeIds: d.user } }, // employeeIds holds User ids
      { session }
    );

    await session.commitTransaction();
    return d;
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
};

/** Unassign deliverer from a center and remove user from LC.employeeIds (if present) */
export const unassignDelivererFromCenter = async (delivererId: string, centerId: string) => {
  if (!mongoose.isValidObjectId(delivererId) || !mongoose.isValidObjectId(centerId)) {
    throw new ApiError(400, "Invalid id(s)");
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const d = await Deliverer.findByIdAndUpdate(
      delivererId,
      { $pull: { logisticCenterIds: new mongoose.Types.ObjectId(centerId) } },
      { new: true, session }
    );
    if (!d) throw new ApiError(404, "Deliverer not found");

    await LogisticsCenter.findByIdAndUpdate(
      centerId,
      { $pull: { employeeIds: d.user } },
      { session }
    );

    await session.commitTransaction();
    return d;
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
};

/** List deliverers assigned to a specific center (lean) */
export const listDeliverersByCenter = async (centerId: string, opts?: { page?: number; limit?: number; sort?: string }) => {
  const page = Math.max(+(opts?.page ?? 1), 1);
  const limit = Math.min(Math.max(+(opts?.limit ?? 20), 1), 200);
  const sort = opts?.sort ?? "-createdAt";

  const filter = { logisticCenterIds: { $in: [new mongoose.Types.ObjectId(centerId)] } };
  const [items, total] = await Promise.all([
    Deliverer.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Deliverer.countDocuments(filter),
  ]);

  return { items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
};