import mongoose,{ FilterQuery, Types } from "mongoose";
import { Order, OrderDoc, OrderStatus, ORDER_STATUSES } from "../models/order.model";
import ApiError from "../utils/ApiError";
import { addOrderIdToFarmerOrder } from "./farmerOrder.service";
import LogisticsCenter from '../models/logisticsCenter.model';
import { getCurrentShift, getShiftWindows } from "./shiftConfig.service"; // ⬅️ add
const STATIC_LC_ID = "66e007000000000000000001";


export interface CreateOrderInput {
  customerId: Types.ObjectId;
  deliveryAddress: any; // AddressSchema-compatible payload
  items: Array<{
    itemId: string;
    name: string;
    imageUrl?: string;
    pricePerUnit: number;
    quantity: number;
    category?: string;
    sourceFarmerName: string;
    sourceFarmName: string;
    farmerOrderId: Types.ObjectId;
  }>;
}

export interface ListOrdersFilter {
  status?: OrderStatus | OrderStatus[];          // single or array
  customerId?: string;
  assignedDelivererId?: string | null;

  // time windows (createdAt by default)
  from?: string;                                  // ISO
  to?: string;                                    // ISO

  // “Shift” helpers – controller will set these if shift is requested
  shiftStart?: string;                            // ISO
  shiftEnd?: string;                              // ISO

  // item-level filters
  itemId?: string;                                // items.itemId
  farmerOrderId?: string;                         // items.farmerOrderId
  category?: string;                              // items.category
  sourceFarmName?: string;                        // partial, case-insensitive
  sourceFarmerName?: string;                      // partial, case-insensitive

  // numeric ranges
  minTotal?: number;                              // totalPrice >=
  maxTotal?: number;                              // totalPrice <=
  minWeight?: number;                             // totalOrderWeightKg >=
  maxWeight?: number;                             // totalOrderWeightKg <=
  logisticsCenterId?: string;
}

export interface ListOrdersOptions {
  page?: number;
  limit?: number;
  sort?: string; // e.g. "-createdAt"
}

export const isValidStatus = (s: string): s is OrderStatus =>
  (ORDER_STATUSES as readonly string[]).includes(s as OrderStatus);

/** Create */


/*
export async function createOrder(payload: CreateOrderInput) {
  const created = await Order.create({
    customerId: payload.customerId,
    deliveryAddress: payload.deliveryAddress,
    items: payload.items,
  });
  return created;
}
*/

//HAS LINKING TO ORDER USE IT AFTER TESTING THAT CREATING AN ORDER FROM MOCK AMS WORKS
export async function createOrder(payload: CreateOrderInput) {
  const session = await mongoose.startSession();
  let createdOrder: any;

  try {
    await session.withTransaction(async () => {
      // 1) create order to get its _id
      const [created] = await Order.create(
        [
          {
            customerId: payload.customerId,
            deliveryAddress: payload.deliveryAddress,
            items: payload.items,
            LogisticsCenterId: STATIC_LC_ID || payload.deliveryAddress.LogisticsCenterId,
          },
        ],
        { session }
      );
      createdOrder = created;

      // 2) link each item to its farmer order with that line's quantity
      for (const it of payload.items) {
        const qty = Number(it.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          const e: any = new Error("BadRequest");
          e.name = "BadRequest";
          e.details = [`quantity must be > 0 for farmerOrderId ${String(it.farmerOrderId)}`];
          throw e;
        }

        await addOrderIdToFarmerOrder(
          created._id,           // accepts ObjectId or string
          it.farmerOrderId,      // accepts ObjectId or string
          qty,
          { session }            // keep atomic with order creation
        );
      }
    });

    return createdOrder;
  } finally {
    session.endSession();
  }
}



/** Get by id */
export async function getOrderById(id: string) {
  const order = await Order.findById(id);
  if (!order) throw new ApiError(404, "Order not found");
  return order;
}

/** Query/paginate with rich filters */
export async function listOrders(filter: ListOrdersFilter = {}, opts: ListOrdersOptions = {}) {
  const q: FilterQuery<OrderDoc> = {};

  // LC filter
  if (filter.logisticsCenterId) {
    q.LogisticsCenterId = new Types.ObjectId(filter.logisticsCenterId);
  }

  // status
  if (filter.status) {
    const arr = Array.isArray(filter.status) ? filter.status : [filter.status];
    const valid = arr.filter((s) => isValidStatus(String(s))) as OrderStatus[];
    if (valid.length) q.status = { $in: valid };
  }

  // ids
  if (typeof filter.assignedDelivererId !== "undefined") {
    q.assignedDelivererId = filter.assignedDelivererId === null ? null : new Types.ObjectId(filter.assignedDelivererId);
  }
  if (filter.customerId) q.customerId = new Types.ObjectId(filter.customerId);

  // time window (createdAt)
  const timeFrom = filter.shiftStart || filter.from;
  const timeTo = filter.shiftEnd || filter.to;
  if (timeFrom || timeTo) {
    q.createdAt = {};
    if (timeFrom) q.createdAt.$gte = new Date(timeFrom);
    if (timeTo) q.createdAt.$lte = new Date(timeTo);
  }

  // numeric ranges
  if (typeof filter.minTotal === "number" || typeof filter.maxTotal === "number") {
    q.totalPrice = {};
    if (typeof filter.minTotal === "number") q.totalPrice.$gte = filter.minTotal;
    if (typeof filter.maxTotal === "number") q.totalPrice.$lte = filter.maxTotal;
  }
  if (typeof filter.minWeight === "number" || typeof filter.maxWeight === "number") {
    q.totalOrderWeightKg = {};
    if (typeof filter.minWeight === "number") q.totalOrderWeightKg.$gte = filter.minWeight;
    if (typeof filter.maxWeight === "number") q.totalOrderWeightKg.$lte = filter.maxWeight;
  }

  // item-level
  const and: any[] = [];
  if (filter.itemId) and.push({ "items.itemId": filter.itemId });
  if (filter.farmerOrderId) and.push({ "items.farmerOrderId": new Types.ObjectId(filter.farmerOrderId) });
  if (filter.category) and.push({ "items.category": filter.category });
  if (filter.sourceFarmName) and.push({ "items.sourceFarmName": { $regex: escapeRegex(filter.sourceFarmName), $options: "i" } });
  if (filter.sourceFarmerName) and.push({ "items.sourceFarmerName": { $regex: escapeRegex(filter.sourceFarmerName), $options: "i" } });
  if (and.length) q.$and = and;

  const page = Math.max(1, Number(opts.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 20));
  const sort = opts.sort || "-createdAt";

  const [items, total] = await Promise.all([
    Order.find(q).sort(sort).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(q),
  ]);

  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Update general fields (hooks keep derived totals in sync) */
export async function updateOrder(
  id: string,
  updates: Partial<Pick<OrderDoc,
    "deliveryAddress" | "items" | "assignedDelivererId" | "customerDeliveryId"
  >>,
  actorId?: Types.ObjectId
) {
  const order = await getOrderById(id);

  if (updates.deliveryAddress) order.deliveryAddress = updates.deliveryAddress as any;
  if (updates.items) order.items = updates.items as any;
  if (typeof updates.assignedDelivererId !== "undefined")
    order.assignedDelivererId = updates.assignedDelivererId as any;
  if (typeof updates.customerDeliveryId !== "undefined")
    order.customerDeliveryId = updates.customerDeliveryId as any;

  if (actorId) order.addAudit(actorId, "order_update", "", { updates });

  await order.validate(); // triggers recalcTotals via pre('validate')
  await order.save();
  return order;
}

/** Status transitions */
const ALLOWED_NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ["confirmed", "canceled"],
  confirmed: ["preparing", "canceled", "problem"],
  preparing: ["ready", "problem", "canceled"],
  ready: ["out_for_delivery", "problem"],
  out_for_delivery: ["delivered", "problem"],
  problem: ["confirmed", "canceled"],
};

export async function updateStatus(
  id: string,
  nextStatus: OrderStatus,
  actorId: Types.ObjectId
) {
  if (!isValidStatus(nextStatus)) throw new ApiError(400, "Invalid status value");

  const order = await getOrderById(id);
  const current = order.status as OrderStatus;

  if (current === "delivered" || current === "canceled") {
    throw new ApiError(400, `Cannot transition from terminal status '${current}'`);
  }
  const allowed = ALLOWED_NEXT[current] || [];
  if (!allowed.includes(nextStatus)) {
    throw new ApiError(
      400,
      `Illegal transition: ${current} → ${nextStatus}. Allowed: ${allowed.join(", ") || "none"}`
    );
  }
  if (nextStatus === "out_for_delivery" && !order.assignedDelivererId) {
    throw new ApiError(400, "Cannot set 'out_for_delivery' without an assigned deliverer");
  }

  order.status = nextStatus;
  order.addAudit(actorId, "status_change", `${current} -> ${nextStatus}`);
  await order.save();
  return order;
}

/** Assign deliverer */
export async function assignDeliverer(
  id: string,
  delivererId: Types.ObjectId | null,
  actorId: Types.ObjectId
) {
  const order = await getOrderById(id);
  order.assignedDelivererId = delivererId as any;
  order.addAudit(actorId, "assign_deliverer", "", { delivererId });
  await order.save();
  return order;
}

/** Add an audit entry */
export async function addAuditEntry(
  id: string,
  actorId: Types.ObjectId,
  action: string,
  note?: string,
  meta?: any
) {
  const order = await getOrderById(id);
  order.addAudit(actorId, action, note, meta);
  await order.save();
  return order;
}

/** Cancel order (convenience) */
export async function cancelOrder(id: string, actorId: Types.ObjectId) {
  const order = await getOrderById(id);
  if (order.status === "delivered" || order.status === "canceled") {
    throw new ApiError(400, `Cannot cancel an order in status '${order.status}'`);
  }
  const prev = order.status;
  order.status = "canceled";
  order.addAudit(actorId, "status_change", `${prev} -> canceled`);
  await order.save();
  return order;
}
