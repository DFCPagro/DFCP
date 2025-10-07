// src/services/order.service.ts
import mongoose, { Types } from "mongoose";
import Order from "../models/order.model";
import { AvailableMarketStockModel } from "../models/availableMarketStock.model";
import { CreateOrderInput } from "../validations/orders.validation";
import { adjustAvailableQtyAtomic } from "./availableMarketStock.service";
import { addOrderIdToFarmerOrder, adjustFarmerOrderAllocatedKg } from "./farmerOrder.service"; // <-- make sure you add it (see section 2)

type IdLike = string | Types.ObjectId;
const toOID = (v: IdLike) => (v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v)));

type AmsLine = {
  _id: Types.ObjectId;
  farmerOrderId?: Types.ObjectId;
  estimates?: { avgWeightPerUnitKg?: number | null };
};

// ───────────────────────────────────────────────────────────────────────────────
// Backwards-compat helpers (support both legacy {quantity} and new unitMode/units/quantityKg)
// ───────────────────────────────────────────────────────────────────────────────
type PayloadItem = CreateOrderInput["items"][number];

// legacy = has 'quantity' and no 'quantityKg'/'units'
const isLegacyItem = (it: any): boolean =>
  it && typeof it === "object" && "quantity" in it && !("quantityKg" in it) && !("units" in it);

// prefer payload snapshot, fall back to AMS estimates
function resolveAvgPerUnit(it: any, amsLine?: AmsLine): number {
  const fromPayload = it?.estimatesSnapshot?.avgWeightPerUnitKg;
  const fromAms = amsLine?.estimates?.avgWeightPerUnitKg;
  const avg =
    Number.isFinite(fromPayload) && (fromPayload as number) > 0
      ? (fromPayload as number)
      : Number.isFinite(fromAms) && (fromAms as number) > 0
      ? (fromAms as number)
      : 0;
  return avg || 0;
}

// normalize any item into { unitMode, quantityKg, units, avg }
function normalizeItem(it: PayloadItem, amsLine?: AmsLine) {
  if (isLegacyItem(it)) {
    // legacy shape -> treat as pure kg order
    const quantityKg = Math.max(0, Number((it as any).quantity) || 0);
    return {
      unitMode: "kg" as const,
      quantityKg,
      units: 0,
      avg: 0, // not needed for pure kg
    };
  } else {
    // new shape
    const unitMode = (it as any).unitMode ?? "kg";
    const quantityKg = Math.max(0, Number((it as any).quantityKg) || 0);
    const units = Math.max(0, Number((it as any).units) || 0);
    const avg = resolveAvgPerUnit(it, amsLine);

    // guard: if units > 0 in unit/mixed, we need avg
    if ((unitMode === "unit" || unitMode === "mixed") && units > 0 && !(avg > 0)) {
      const e: any = new Error("BadRequest");
      e.name = "BadRequest";
      e.details = [
        `Missing avgWeightPerUnitKg for item ${String((it as any).itemId)} while units > 0.`,
      ];
      throw e;
    }

    return { unitMode, quantityKg, units, avg };
  }
}

function computeEstimatedKgNormalized(n: { quantityKg: number; units: number; avg: number }): number {
  const eff = n.quantityKg + n.units * n.avg;
  return Math.max(0, Math.round(eff * 1000) / 1000);
}

// ───────────────────────────────────────────────────────────────────────────────
// Create order
// ───────────────────────────────────────────────────────────────────────────────
export async function createOrderForCustomer(userId: IdLike, payload: CreateOrderInput) {
  const session = await mongoose.startSession();

  const customerOID = toOID(userId);
  const amsOID = toOID(payload.amsId);
  const lcOID = toOID(payload.logisticsCenterId);

  let orderDoc: any;

  try {
    await session.withTransaction(async () => {
      // 1) Load AMS for line lookups
      const ams = await AvailableMarketStockModel.findById(amsOID, { items: 1, availableShift: 1 })
        .lean(false)
        .session(session);
      if (!ams) {
        const err: any = new Error("AvailableMarketStock not found");
        err.name = "NotFound";
        throw err;
      }

      const itemsArr: AmsLine[] = Array.isArray((ams as any).items) ? ((ams as any).items as any) : [];
      const byFO = new Map<string, AmsLine>();
      for (const line of itemsArr) {
        const fo = (line as any).farmerOrderId ? String((line as any).farmerOrderId) : "";
        if (fo) byFO.set(fo, line);
      }

      // 2) Reserve AMS by estimated kg
      for (const it of payload.items as PayloadItem[]) {
        const line = byFO.get(String((it as any).farmerOrderId));
        if (!line || !line._id) {
          const err: any = new Error(`AMS line not found for farmerOrderId ${(it as any).farmerOrderId}`);
          err.name = "BadRequest";
          err.details = ["Ensure AMS has a line whose farmerOrderId matches the requested item."];
          throw err;
        }

        const n = normalizeItem(it, line);
        const estKg = computeEstimatedKgNormalized(n);
        if (!(estKg > 0)) {
          const err: any = new Error(`Invalid estimated kg for item ${(it as any).itemId}`);
          err.name = "BadRequest";
          throw err;
        }

        await adjustAvailableQtyAtomic({
          docId: amsOID.toString(),
          lineId: String(line._id),
          deltaKg: -estKg,
          enforceEnoughForReserve: true,
          session,
        });
      }

      // 3) Create Order (new shape) — legacy items are auto-normalized
      const orderPayload = {
        customerId: customerOID,
        deliveryAddress: payload.deliveryAddress,
        deliveryDate: payload.deliveryDate,
        LogisticsCenterId: lcOID,
        shiftName: (ams as any).availableShift,
        amsId: amsOID,
        items: (payload.items as PayloadItem[]).map((it) => {
          const line = byFO.get(String((it as any).farmerOrderId));
          const n = normalizeItem(it, line);
          return {
            itemId: toOID((it as any).itemId),
            name: (it as any).name,
            imageUrl: (it as any).imageUrl ?? "",
            pricePerUnit: (it as any).pricePerUnit, // per KG

            unitMode: n.unitMode,
            quantityKg: n.quantityKg,
            units: n.units,

            estimatesSnapshot: n.avg > 0 ? { avgWeightPerUnitKg: n.avg } : undefined,

            category: (it as any).category ?? "",
            sourceFarmerName: (it as any).sourceFarmerName,
            sourceFarmName: (it as any).sourceFarmName,

            farmerOrderId: toOID((it as any).farmerOrderId),
          };
        }),
      };

      [orderDoc] = await Order.create([orderPayload], { session });

      // 4) Link each FarmerOrder using **estimated kg**
      for (const it of payload.items as PayloadItem[]) {
        const line = byFO.get(String((it as any).farmerOrderId));
        const n = normalizeItem(it, line);
        const estKg = computeEstimatedKgNormalized(n);
        await addOrderIdToFarmerOrder(orderDoc._id, toOID((it as any).farmerOrderId), estKg, { session });
      }

      // 5) Audit & save
      orderDoc.addAudit(customerOID, "ORDER_CREATED", "Customer placed an order", {
        itemsCount: payload.items.length,
      });
      await orderDoc.save({ session });
    });

    return orderDoc.toJSON();
  } finally {
    session.endSession();
  }
}


// ───────────────────────────────────────────────────────────────────────────────
// List latest 15 orders
// ───────────────────────────────────────────────────────────────────────────────
export async function listOrdersForCustomer(userId: IdLike, limit = 15) {
  const customerOID = toOID(userId);

  const docs = await Order.find({ customerId: customerOID })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(limit, 15)))
    .lean()
    .exec();

  return docs;
}
