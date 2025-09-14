import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import ApiError from "../utils/ApiError";
import {
  createOrder,
  getOrderById,
  listOrders,
  updateOrder,
  updateStatus,
  assignDeliverer,
  addAuditEntry,
  cancelOrder,
  isValidStatus,
} from "../services/order.service";
import { Role } from "../utils/constants";

// Role buckets from your set:
// ['customer','farmer','deliverer','industrialDeliverer','dManager','fManager','opManager','admin']
const STAFF_ROLES: Role[] = ["opManager", "dManager", "fManager", "admin"] as any;
const COURIER_ROLES: Role[] = ["deliverer", "industrialDeliverer"] as any;
const CUSTOMER_ROLE: Role = "customer" as any;

const asyncHandler =
  (fn: any) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function ensureOwnerOrStaff(req: Request, orderCustomerId: Types.ObjectId) {
  // @ts-ignore
  const user = req.user as { _id: Types.ObjectId; role: Role };
  const isOwner = user && orderCustomerId.equals(user._id);
  const isStaff = user && STAFF_ROLES.includes(user.role);
  const isCourier = user && COURIER_ROLES.includes(user.role);
  if (!(isOwner || isStaff || isCourier)) throw new ApiError(403, "Forbidden");
}

/** Create (customer) */
export const create = asyncHandler(async (req: Request, res: Response) => {
  // @ts-ignore
  const user = req.user as { _id: Types.ObjectId };
  const { deliveryAddress, items } = req.body || {};
  if (!deliveryAddress || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "deliveryAddress and non-empty items[] are required");
  }
  const order = await createOrder({ customerId: user._id, deliveryAddress, items });
  res.status(201).json({ data: order });
});

/** Get one */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const order = await getOrderById(req.params.id);
  ensureOwnerOrStaff(req, order.customerId as Types.ObjectId);
  res.json({ data: order });
});

/** List (filters + shifts) */
export const list = asyncHandler(async (req: Request, res: Response) => {
  // @ts-ignore
  const user = req.user as { _id: Types.ObjectId; role: Role };
  const q = req.query;

  // status can be single, comma-separated, or repeated
  const statusList: string[] = Array.isArray(q.status)
    ? (q.status as string[])
    : typeof q.status === "string"
      ? q.status.split(",")
      : [];

  const filter: any = {
    // ids
    assignedDelivererId: typeof q.assignedDelivererId === "string" ? q.assignedDelivererId : undefined,
    customerId: typeof q.customerId === "string" ? q.customerId : undefined,

    // time
    from: typeof q.from === "string" ? q.from : undefined,
    to: typeof q.to === "string" ? q.to : undefined,

    // item-level
    itemId: typeof q.itemId === "string" ? q.itemId : undefined,
    farmerOrderId: typeof q.farmerOrderId === "string" ? q.farmerOrderId : undefined,
    category: typeof q.category === "string" ? q.category : undefined,
    sourceFarmName: typeof q.sourceFarmName === "string" ? q.sourceFarmName : undefined,
    sourceFarmerName: typeof q.sourceFarmerName === "string" ? q.sourceFarmerName : undefined,

    // numeric ranges
    minTotal: q.minTotal ? Number(q.minTotal) : undefined,
    maxTotal: q.maxTotal ? Number(q.maxTotal) : undefined,
    minWeight: q.minWeight ? Number(q.minWeight) : undefined,
    maxWeight: q.maxWeight ? Number(q.maxWeight) : undefined,
  };

  if (statusList.length) {
    const valid = statusList.filter((s) => isValidStatus(s));
    if (!valid.length) throw new ApiError(400, "Invalid status filter");
    filter.status = valid;
  }

  // Customers only see their own
  if (user.role === CUSTOMER_ROLE) {
    filter.customerId = user._id.toString();
  }

  // SHIFTS:
  // Option A: ?shiftStart=ISO&shiftEnd=ISO   (overrides from/to)
  // Option B: ?date=YYYY-MM-DD&shift=morning|afternoon|evening|night
  if (typeof q.shiftStart === "string") filter.shiftStart = q.shiftStart;
  if (typeof q.shiftEnd === "string") filter.shiftEnd = q.shiftEnd;

  if (!filter.shiftStart && !filter.shiftEnd && typeof q.shift === "string") {
    const date = typeof q.date === "string" ? q.date : undefined; // YYYY-MM-DD
    const range = deriveShiftWindow(q.shift, date);
    if (range) {
      filter.shiftStart = range.start.toISOString();
      filter.shiftEnd = range.end.toISOString();
    }
  }

  const data = await listOrders(filter, {
    page: q.page ? Number(q.page) : undefined,
    limit: q.limit ? Number(q.limit) : undefined,
    sort: q.sort ? String(q.sort) : undefined,
  });

  res.json({ data });
});

/** Convenience: list my orders (customer) */
export const listMine = asyncHandler(async (req: Request, res: Response) => {
  // @ts-ignore
  const user = req.user as { _id: Types.ObjectId };
  const data = await listOrders(
    { customerId: user._id.toString() },
    {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      sort: "-createdAt",
    }
  );
  res.json({ data });
});

/** Update general fields (owner while early, or staff) */
export const updateGeneral = asyncHandler(async (req: Request, res: Response) => {
  const order = await getOrderById(req.params.id);
  ensureOwnerOrStaff(req, order.customerId as Types.ObjectId);

  // @ts-ignore
  const user = req.user as { role: Role; _id: Types.ObjectId };
  if (user.role === CUSTOMER_ROLE && !["pending", "confirmed"].includes(order.status)) {
    throw new ApiError(400, "Customer cannot modify the order after it is being prepared");
  }

  const allowedFields = ["deliveryAddress", "items", "assignedDelivererId", "customerDeliveryId"];
  const updates: any = {};
  for (const k of allowedFields) if (k in req.body) updates[k] = req.body[k];

  const saved = await updateOrder(req.params.id, updates, user._id);
  res.json({ data: saved });
});

/** Update status (deliverers limited, staff unrestricted) */
export const setStatus = asyncHandler(async (req: Request, res: Response) => {
  // @ts-ignore
  const user = req.user as { _id: Types.ObjectId; role: Role };
  const { status } = req.body || {};
  if (!status || !isValidStatus(status)) throw new ApiError(400, "Valid status is required");

  // Deliverers can do: ready -> out_for_delivery -> delivered (or -> problem)
  if (COURIER_ROLES.includes(user.role)) {
    const order = await getOrderById(req.params.id);
    const allowedByDeliverer: Record<string, string[]> = {
      ready: ["out_for_delivery", "problem"],
      out_for_delivery: ["delivered", "problem"],
    };
    const allowed = allowedByDeliverer[order.status] || [];
    if (!allowed.includes(status)) throw new ApiError(403, "Not allowed for deliverer");
  }

  const saved = await updateStatus(req.params.id, status, user._id);
  res.json({ data: saved });
});

/** Assign / unassign deliverer (staff) */
export const setDeliverer = asyncHandler(async (req: Request, res: Response) => {
  // @ts-ignore
  const user = req.user as { _id: Types.ObjectId; role: Role };
  if (!STAFF_ROLES.includes(user.role)) throw new ApiError(403, "Forbidden");

  const { delivererId } = req.body || {};
  const id = delivererId ? new Types.ObjectId(delivererId) : null;

  const saved = await assignDeliverer(req.params.id, id, user._id);
  res.json({ data: saved });
});

/** Add audit entry (any actor) */
export const addAudit = asyncHandler(async (req: Request, res: Response) => {
  // @ts-ignore
  const user = req.user as { _id: Types.ObjectId };
  const { action, note, meta } = req.body || {};
  if (!action) throw new ApiError(400, "action is required");
  const saved = await addAuditEntry(req.params.id, user._id, action, note, meta);
  res.json({ data: saved });
});

/** Cancel (owner or staff; ownership checked) */
export const cancel = asyncHandler(async (req: Request, res: Response) => {
  // @ts-ignore
  const user = req.user as { _id: Types.ObjectId; role: Role };
  const order = await getOrderById(req.params.id);
  ensureOwnerOrStaff(req, order.customerId as Types.ObjectId);
  const saved = await cancelOrder(order.id, user._id);
  res.json({ data: saved });
});

/** Basic shift parser
 * morning: 06:00–12:00, afternoon: 12:00–18:00, evening: 18:00–23:00, night: 23:00–06:00 (next day)
 * If no date is given, uses today's date (server timezone).
 */
function deriveShiftWindow(
  shift: string,
  date?: string
): { start: Date; end: Date } | null {
  const base = date ? new Date(`${date}T00:00:00`) : new Date(); // midnight (server TZ)
  const start = new Date(base);
  const end = new Date(base);

  const setHM = (d: Date, h: number, m = 0) => {
    d.setHours(h, m, 0, 0);
  };

  switch (shift) {
    case "morning":
      setHM(start, 6, 0);
      setHM(end, 12, 0);
      break;
    case "afternoon":
      setHM(start, 12, 0);
      setHM(end, 18, 0);
      break;
    case "evening":
      setHM(start, 18, 0);
      setHM(end, 23, 0);
      break;
    case "night":
      setHM(start, 23, 0);
      end.setDate(end.getDate() + 1);
      setHM(end, 6, 0);
      break;
    default:
      return null;
  }
  return { start, end };
}
