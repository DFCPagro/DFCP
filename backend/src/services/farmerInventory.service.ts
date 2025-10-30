// src/services/farmerInventory.service.ts
import type { ClientSession, FilterQuery, UpdateQuery } from "mongoose";
import FarmerInventoryModel from "../models/farmerInventory.model";
import { getContactInfoByIdService } from "../services/user.service"; // adjust path


/** Shared types for filters & pagination */
export type ListFilters = {
  farmerId?: string;
  itemId?: string;
  logisticCenterId?: string;
};

export type Pagination = {
  page?: number; // 1-based
  limit?: number;
};

export type ListResult<T> = {
  data: T[];
  page?: number;
  limit?: number;
  total?: number;
};

const DEFAULT_SORT = { updatedAt: -1 } as const;

/* ----------------------------------------------------------------------------
 * List
 * --------------------------------------------------------------------------*/
export async function listInventory(
  filters: ListFilters,
  pagination?: Pagination,
  opts?: { session?: ClientSession }
): Promise<ListResult<any>> {
  const query: FilterQuery<any> = {};
  if (filters.farmerId) query.farmerId = filters.farmerId;
  if (filters.itemId) query.itemId = filters.itemId;
  if (filters.logisticCenterId)
    query.logisticCenterId = filters.logisticCenterId;

  const page =
    pagination?.page && pagination.page > 0 ? pagination.page : undefined;
  const limit =
    pagination?.limit && pagination.limit > 0 ? pagination.limit : undefined;

  let data: any[];
  let total: number | undefined;

  if (!page || !limit) {
    data = await FarmerInventoryModel.find(query, null, {
      sort: DEFAULT_SORT,
      session: opts?.session,
    }).lean();
  } else {
    const skip = (page - 1) * limit;
    [data, total] = await Promise.all([
      FarmerInventoryModel.find(query, null, {
        sort: DEFAULT_SORT,
        skip,
        limit,
        session: opts?.session,
      }).lean(),
      FarmerInventoryModel.countDocuments(query).session(opts?.session ?? null),
    ]);
  }

  // ----------------------------
  // 🔹 Enrich with farmer info
  // ----------------------------
  const farmerIds = [...new Set(data.map((d) => String(d.farmerId)))];

  const contactMap = new Map<string, any>();
  for (const farmerId of farmerIds) {
    try {
      const info = await getContactInfoByIdService(farmerId);
      contactMap.set(farmerId, {
        farmName: info.farmName ?? null,
        farmLogo: info.farmLogo ?? null,
      });
    } catch {
      contactMap.set(farmerId, { farmName: null, farmLogo: null });
    }
  }

  const enriched = data.map((d) => ({
    ...d,
    farmName: contactMap.get(String(d.farmerId))?.farmName ?? null,
    farmLogo: contactMap.get(String(d.farmerId))?.farmLogo ?? null,
  }));

  if (!page || !limit) return { data: enriched };
  return { data: enriched, page, limit, total };
}

/* ----------------------------------------------------------------------------
 * Get by id
 * --------------------------------------------------------------------------*/
export async function getInventoryById(
  id: string,
  opts?: { session?: ClientSession }
) {
  return FarmerInventoryModel.findById(id, null, {
    session: opts?.session,
  }).lean();
}

/* ----------------------------------------------------------------------------
 * Create (single)
 * Body: { farmerId, itemId, logisticCenterId?, agreementAmountKg?, currentAvailableAmountKg? }
 * Business rule guard (defense in depth): if both provided, available ≤ agreement.
 * --------------------------------------------------------------------------*/
export async function createInventory(
  payload: {
    farmerId: string;
    itemId: string;
    logisticCenterId?: string | null;
    agreementAmountKg?: number;
    currentAvailableAmountKg?: number;
  },
  opts?: { session?: ClientSession }
) {
  const {
    farmerId,
    itemId,
    logisticCenterId,
    agreementAmountKg,
    currentAvailableAmountKg,
  } = payload;

  if (
    agreementAmountKg !== undefined &&
    currentAvailableAmountKg !== undefined &&
    currentAvailableAmountKg > agreementAmountKg
  ) {
    const err = new Error(
      "currentAvailableAmountKg cannot be greater than agreementAmountKg"
    );
    // You can attach a status for your error handler, or throw as-is
    // @ts-expect-error augment for centralized error mapper
    err.status = 422;
    throw err;
  }

  return FarmerInventoryModel.create(
    [
      {
        farmerId,
        itemId,
        logisticCenterId: logisticCenterId ?? undefined,
        agreementAmountKg,
        currentAvailableAmountKg,
      },
    ],
    { session: opts?.session }
  ).then((docs) => docs[0].toObject());
}

/* ----------------------------------------------------------------------------
 * Update by id (PATCH semantics)
 * Body: subset of { agreementAmountKg, currentAvailableAmountKg, logisticCenterId? }
 * Enforces amounts ≥ 0 at model level; also guards available ≤ agreement when both present.
 * --------------------------------------------------------------------------*/
export async function updateInventoryById(
  id: string,
  patch: {
    agreementAmountKg?: number;
    currentAvailableAmountKg?: number;
    logisticCenterId?: string | null;
  },
  opts?: { session?: ClientSession }
) {
  // Optional cross-field rule (defense in depth)
  const a = patch.agreementAmountKg;
  const c = patch.currentAvailableAmountKg;
  if (a !== undefined && c !== undefined && c > a) {
    const err = new Error(
      "currentAvailableAmountKg cannot be greater than agreementAmountKg"
    );
    // @ts-expect-error augment for centralized error mapper
    err.status = 422;
    throw err;
  }

  const update: UpdateQuery<any> = { $set: {} };
  if (patch.agreementAmountKg !== undefined) {
    (update.$set as any).agreementAmountKg = patch.agreementAmountKg;
  }
  if (patch.currentAvailableAmountKg !== undefined) {
    (update.$set as any).currentAvailableAmountKg =
      patch.currentAvailableAmountKg;
  }
  if (patch.logisticCenterId !== undefined) {
    (update.$set as any).logisticCenterId = patch.logisticCenterId ?? undefined;
  }

  const doc = await FarmerInventoryModel.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
    session: opts?.session,
  }).lean();

  return doc; // null if not found
}
