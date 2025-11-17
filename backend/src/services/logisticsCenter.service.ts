import mongoose from 'mongoose';
import LogisticsCenter, { TLogisticsCenter } from '../models/logisticsCenter.model';
import Order from '../models/order.model';
import { Deliverer } from "../models/deliverer.model";
import ApiError from "../utils/ApiError";

export type CreateLogisticsCenterDTO = {
  logisticName: string;
  address: {
    name: string;
    geo?: { type: 'Point'; coordinates: [number, number] };
  };
  employeeIds?: mongoose.Types.ObjectId[];
  deliveryHistory?: { message: string; at?: Date; by?: mongoose.Types.ObjectId | null }[];
};

export type UpdateLogisticsCenterDTO = Partial<CreateLogisticsCenterDTO>;

export type QueryOptions = {
  page?: number;      // 1-based
  limit?: number;     // page size
  sort?: string;      // e.g. "-createdAt" or "logisticName"
  select?: string;    // e.g. "logisticName location.name"
  populate?: boolean; // populate refs/virtuals
};

export type QueryFilter = {
  search?: string;     // fuzzy on logisticName / location.name
  employeeId?: string; // centers containing this employee
  // Geo filters (optional)
  nearLng?: number;
  nearLat?: number;
  maxMeters?: number;  // default 10km
  // Derived: whether center has active orders
  active?: boolean;
};

// Active = any order in these statuses
const ACTIVE_STATUSES = new Set([
  'confirmed', 'packing', 'ready_for_pickup', 'in-transit', 'out_for_delivery'
]);

/** CREATE */
export async function createLogisticsCenter(
  payload: CreateLogisticsCenterDTO
): Promise<TLogisticsCenter> {
  return LogisticsCenter.create(payload);
}

/** GET BY ID */
export async function getLogisticsCenterById(
  id: string,
  options?: { populate?: boolean; select?: string }
): Promise<TLogisticsCenter | null> {
  let q = LogisticsCenter.findById(id);
  if (options?.select) q = q.select(options.select);
  if (options?.populate) {
    // populate virtual activeOrders + employees
    q = q.populate({ path: 'activeOrders' }).populate('employeeIds');
  }
  return q.lean().exec();
}

/** LIST / QUERY */
export async function queryLogisticsCenters(
  filter: QueryFilter = {},
  options: QueryOptions = {}
) {
  const {
    page = 1,
    limit = 20,
    sort = '-createdAt',
    select,
    populate = false,
  } = options;

  // ---- Base where (used in simple path) ----
  const where: Record<string, any> = {};

  if (filter.employeeId && mongoose.isValidObjectId(filter.employeeId)) {
    where.employeeIds = new mongoose.Types.ObjectId(filter.employeeId);
  }

  if (filter.search) {
    const r = new RegExp(filter.search, 'i');
    where.$or = [{ logisticName: r }, { 'location.name': r }];
  }

  // Optional $near geo filter
  if (filter.nearLng != null && filter.nearLat != null) {
    where['location.geo'] = {
      $near: {
        $geometry: { type: 'Point', coordinates: [filter.nearLng, filter.nearLat] },
        $maxDistance: filter.maxMeters ?? 10000,
      },
    };
  }

  // ---- If active filter is not requested, use fast .find() path ----
  if (typeof filter.active === 'undefined') {
    let q = LogisticsCenter.find(where);
    if (select) q = q.select(select);
    if (populate) q = q.populate({ path: 'activeOrders' }).populate('employeeIds');

    const [results, total] = await Promise.all([
      q.sort(sort).skip((page - 1) * limit).limit(limit).lean().exec(),
      LogisticsCenter.countDocuments(where),
    ]);

    return {
      results,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // ---- Active filter path: use aggregation with $lookup to Orders ----
  const isActiveWanted = !!filter.active;

  const pipeline: any[] = [
    { $match: where },
    {
      $lookup: {
        from: Order.collection.name,
        let: { centerId: '$_id' },
        pipeline: [
          { $match: {
              $expr: { $eq: ['$logisticCenterId', '$$centerId'] },
              status: { $in: Array.from(ACTIVE_STATUSES) as string[] },
          }},
          { $limit: 1 }, // we only need to know if at least one exists
        ],
        as: '__activeHit',
      },
    },
    { $addFields: { __hasActive: { $gt: [{ $size: '$__activeHit' }, 0] } } },
    { $match: isActiveWanted ? { __hasActive: true } : { __hasActive: false } },
    { $project: { __activeHit: 0, __hasActive: 0 } },
    // Sorting + pagination
    ...(sort ? [{ $sort: buildSort(sort) }] : []),
    { $skip: (page - 1) * limit },
    { $limit: limit },
  ];

  const countPipeline = [
    { $match: where },
    {
      $lookup: {
        from: Order.collection.name,
        let: { centerId: '$_id' },
        pipeline: [
          { $match: {
              $expr: { $eq: ['$logisticCenterId', '$$centerId'] },
              status: { $in: Array.from(ACTIVE_STATUSES) as string[] },
          }},
          { $limit: 1 },
        ],
        as: '__activeHit',
      },
    },
    { $addFields: { __hasActive: { $gt: [{ $size: '$__activeHit' }, 0] } } },
    { $match: isActiveWanted ? { __hasActive: true } : { __hasActive: false } },
    { $count: 'count' },
  ];

  const [results, count] = await Promise.all([
    LogisticsCenter.aggregate(pipeline).exec(),
    LogisticsCenter.aggregate(countPipeline).exec(),
  ]);

  // (Optional) populate after aggregation (only if needed)
  let populated = results;
  if (populate) {
    populated = await LogisticsCenter.populate(results, [
      { path: 'activeOrders' },
      { path: 'employeeIds' },
    ]);
  }
  if (select) {
    // apply projection post-aggregation if select provided
    populated = populated.map((d: any) => project(d, select));
  }

  const total = count?.[0]?.count ?? 0;
  return {
    results: populated,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function buildSort(sort: string) {
  // e.g. '-createdAt logisticName' => { createdAt: -1, logisticName: 1 }
  return sort.split(/\s+/).filter(Boolean).reduce((acc, key) => {
    if (key.startsWith('-')) acc[key.slice(1)] = -1;
    else acc[key] = 1;
    return acc;
  }, {} as Record<string, 1 | -1>);
}

function project<T extends Record<string, any>>(doc: T, select: string): T {
  // very light projection utility for lean results
  const keep = new Set(select.split(/\s+/).filter(Boolean));
  if (keep.size === 0) return doc;
  const out: any = {};
  for (const k of keep) out[k] = k.split('.').reduce((o, p) => (o ? o[p] : undefined), doc);
  out._id = doc._id; // always keep _id
  return out;
}

/** UPDATE */
export async function updateLogisticsCenterById(
  id: string,
  update: UpdateLogisticsCenterDTO,
  options?: { newDoc?: boolean; populate?: boolean; select?: string }
): Promise<TLogisticsCenter | null> {
  let q = LogisticsCenter.findByIdAndUpdate(id, update, {
    new: options?.newDoc ?? true,
    runValidators: true,
  });
  if (options?.select) q = q.select(options.select);
  if (options?.populate) q = q.populate({ path: 'activeOrders' }).populate('employeeIds');
  return q.lean().exec();
}

/** DELETE */
export async function deleteLogisticsCenterById(id: string): Promise<void> {
  await LogisticsCenter.findByIdAndDelete(id).exec();
}


export const listDeliverersForCenter = async (centerId: string, opts?: { page?: number; limit?: number; sort?: string }) => {
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

export const assignCenterDeliverer = async (centerId: string, delivererId: string) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const d = await Deliverer.findByIdAndUpdate(
      delivererId,
      { $addToSet: { logisticCenterIds: new mongoose.Types.ObjectId(centerId) } },
      { new: true, session }
    );
    if (!d) throw new ApiError(404, "Deliverer not found");

    const lc = await LogisticsCenter.findByIdAndUpdate(
      centerId,
      { $addToSet: { employeeIds: d.user } },
      { new: true, session }
    );
    if (!lc) throw new ApiError(404, "Logistics center not found");

    await session.commitTransaction();
    return { deliverer: d, center: lc };
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
};

export const unassignCenterDeliverer = async (centerId: string, delivererId: string) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const d = await Deliverer.findByIdAndUpdate(
      delivererId,
      { $pull: { logisticCenterIds: new mongoose.Types.ObjectId(centerId) } },
      { new: true, session }
    );
    if (!d) throw new ApiError(404, "Deliverer not found");

    const lc = await LogisticsCenter.findByIdAndUpdate(
      centerId,
      { $pull: { employeeIds: d.user } },
      { new: true, session }
    );
    if (!lc) throw new ApiError(404, "Logistics center not found");

    await session.commitTransaction();
    return { deliverer: d, center: lc };
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
};