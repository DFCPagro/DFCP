import { FilterQuery, ClientSession, Types } from "mongoose";
import { AvailableMarketStockModel, AvailableStockItem, AvailableMarketStock} from "../models/availableMarketStock.model";
import { SHIFT_NAMES } from "../models/availableMarketStock.model";
import ItemModel from "../models/Item.model"; // adjust import to your project path
import { getNextAvailableShifts, getShiftConfigByKey } from "./shiftConfig.service"; // <-- use your actual path
import { DateTime } from "luxon";
import { normalizeWindow } from "../utils/time";
type ShiftName = (typeof SHIFT_NAMES)[number];
type ItemsOnly = { _id: Types.ObjectId; items: AvailableStockItem[] };


function normalizeDateUTC(d: Date | string): Date {
  const dd = typeof d === "string" ? new Date(d) : new Date(d);
  dd.setUTCHours(0, 0, 0, 0);
  return dd;
}

function toDateTime(tz: string, dateISO: string, minutesFromMidnight: number) {
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  return DateTime.fromISO(dateISO, { zone: tz }).set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
}

const fmtHHMM = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

async function getDeliverySlotLabel(params: { LCid: string; shift: ShiftName }): Promise<string> {
  const cfg = await getShiftConfigByKey({ logisticCenterId: params.LCid, name: params.shift });
  const slot = normalizeWindow(cfg.deliveryTimeSlotStartMin, cfg.deliveryTimeSlotEndMin);
  return `${fmtHHMM(slot.startMin)}–${fmtHHMM(slot.endMin)}`;
}
export async function findOrCreateAvailableMarketStock(params: {
  LCid: string;
  date: string | Date;
  shift: ShiftName;
  createdById?: string | Types.ObjectId | null;
}) {
  const { LCid, date, shift, createdById = null } = params;
  const availableDate = normalizeDateUTC(date);

  const existing = await AvailableMarketStockModel.findOne({
    LCid,
    availableDate,
    availableShift: shift,
  });
  if (existing) return existing;

  return AvailableMarketStockModel.create({
    LCid,
    availableDate,
    availableShift: shift,
    createdById: createdById ? new Types.ObjectId(createdById) : null,
    items: [],
  });
}

export async function getAvailableMarketStockByKey(params: {
  LCid: string;
  date: string | Date;
  shift: ShiftName;
}) {
  const { LCid, date, shift } = params;
  const availableDate = normalizeDateUTC(date);
  return AvailableMarketStockModel.findOne({
    LCid,
    availableDate,
    availableShift: shift,
  });
}

/**
 * Get an AvailableMarketStock document by its _id (stock id).
 */
export async function getAvailableMarketStockById(docId: string) {
  const _docId = new Types.ObjectId(docId);

  const doc = await AvailableMarketStockModel.findById(_docId).lean<AvailableMarketStock | null>();

  if (!doc) {
    throw new Error("AvailableMarketStock not found");
  }

  return doc;
}



//returns full on shifts stock
export async function listUpcomingAvailableMarketStock(params: {
  LCid: string;
  count?: number;
  fromDate?: string | Date;
}) {
  const { LCid, count = 6, fromDate } = params;
  const start = normalizeDateUTC(fromDate ?? new Date());
  const q: FilterQuery<any> = { LCid, availableDate: { $gte: start } };
  return AvailableMarketStockModel.find(q)
    .sort({ availableDate: 1, availableShift: 1 })
    .limit(count)
    .lean();
}



/**
 * For the next 5 shifts (by LC timezone), return only those that have
 * a stock doc with items, plus the delivery time-slot label for that shift.
 */
export async function nextFiveShiftsWithStock(params: {
  LCid: string;
  fromTs?: number;
}): Promise<Array<{ date: string; shift: ShiftName; docId: string; deliverySlotLabel: string }>> {
  const { LCid, fromTs } = params;

  // 1) Next exactly 5 shifts from shiftConfig (ordered)
  const upcoming = await getNextAvailableShifts({ logisticCenterId: LCid, count: 5, fromTs }); // [{date, name}]

  // 2) Single Mongo query for any existing docs among those 5
  const orPairs = upcoming.map(s => ({
    LCid,
    availableDate: normalizeDateUTC(s.date),
    availableShift: s.name as ShiftName,
  }));
  if (orPairs.length === 0) return [];

  const docs = await AvailableMarketStockModel.find(
    { $or: orPairs },
    { _id: 1, availableDate: 1, availableShift: 1, items: 1 }
  ).lean();

  // 3) Index found docs by (dateISO|shift)
  const key = (d: Date, s: string) => `${d.toISOString()}|${s}`;
  const byKey = new Map<string, { _id: Types.ObjectId; items: any[] }>();

  for (const d of docs) {
    byKey.set(key(d.availableDate, d.availableShift), {
      _id: d._id as Types.ObjectId,
      items: (d as any).items ?? [],
    });
  }

  // 4) Build output in the same order, only if doc has items
  const out: Array<{ date: string; shift: ShiftName; docId: string; deliverySlotLabel: string }> = [];
  for (const s of upcoming) {
    const hit = byKey.get(
      `${normalizeDateUTC(s.date).toISOString()}|${s.name}`
    );
    if (hit && hit.items.length > 0) {
      const deliverySlotLabel = await getDeliverySlotLabel({ LCid, shift: s.name as ShiftName });
      out.push({
        date: s.date,
        shift: s.name as ShiftName,
        docId: String(hit._id),
        deliverySlotLabel,
      });
    }
  }
  return out;
}

async function computePriceFromItem(
  itemId: string | Types.ObjectId
): Promise<number> {
  const _id = typeof itemId === "string" ? new Types.ObjectId(itemId) : itemId;
  const it = await ItemModel.findById(_id, { price: 1 }).lean();
  if (!it || !it.price || typeof (it as any).price.a !== "number") {
    throw new Error("Item price.a not found");
  }
  return Number(((it as any).price.a * 1.2).toFixed(2));
}

/**
 * Atomically adjust quantity by deltaKg for a specific line in items[].
 * - deltaKg < 0 => reserve (decrement)
 * - deltaKg > 0 => release (increment)
 *
 * If `enforceEnoughForReserve` is true (default), a reserve (negative delta) will only succeed
 * when currentAvailableQuantityKg >= |deltaKg|.
 *
 * NOW session-aware: pass the same session used in your cart transaction.
 */
export async function adjustAvailableQtyAtomic(params: {
  docId: string;
  lineId: string;
  deltaKg: number;
  enforceEnoughForReserve?: boolean;
  session?: ClientSession | null;
}) {
  const {
    docId,
    lineId,
    deltaKg,
    enforceEnoughForReserve = true,
    session,
  } = params;
  if (!deltaKg || !Number.isFinite(deltaKg))
    throw new Error("deltaKg must be a non-zero finite number");

  const _docId = new Types.ObjectId(docId);
  const _lineId = new Types.ObjectId(lineId);

  const filter: any = { _id: _docId };

  if (deltaKg < 0 && enforceEnoughForReserve) {
    const need = Math.abs(deltaKg);
    filter.items = {
      $elemMatch: { _id: _lineId, currentAvailableQuantityKg: { $gte: need } },
    };
  }

  const q = AvailableMarketStockModel.updateOne(filter, [
    {
      $set: {
        items: {
          $map: {
            input: "$items",
            as: "it",
            in: {
              $cond: [
                { $eq: ["$$it._id", _lineId] },
                {
                  $mergeObjects: [
                    "$$it",
                    {
                      currentAvailableQuantityKg: {
                        $max: [
                          0,
                          {
                            $min: [
                              "$$it.originalCommittedQuantityKg",
                              {
                                $add: [
                                  "$$it.currentAvailableQuantityKg",
                                  deltaKg,
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    },
                  ],
                },
                "$$it",
              ],
            },
          },
        },
      },
    },
  ]);
  if (session) q.session(session);
  const result = await q.exec();

  if (result.matchedCount === 0) {
    if (deltaKg < 0 && enforceEnoughForReserve)
      throw new Error("Not enough available quantity to reserve");
    throw new Error("Document not found or lineId invalid");
  }

  return { ok: true };
}

export async function addItemToAvailableMarketStock(params: {
  docId: string;
  item: {
    itemId: string;
    displayName: string;
    imageUrl?: string | null;
    category: string;
    pricePerUnit?: number;
    originalCommittedQuantityKg: number;
    currentAvailableQuantityKg: number;
    farmerOrderId?: string | null;
    farmerID: string;
    farmerName: string;
    farmName: string;
    status?: "active" | "soldout" | "removed";
  };
}) {
  const { docId, item } = params;

  let pricePerUnit = item.pricePerUnit;
  if (pricePerUnit == null)
    pricePerUnit = await computePriceFromItem(item.itemId);

  const payload = {
    itemId: new Types.ObjectId(item.itemId),
    displayName: item.displayName,
    imageUrl: item.imageUrl ?? null,
    category: item.category,
    pricePerUnit,
    originalCommittedQuantityKg: item.originalCommittedQuantityKg,
    currentAvailableQuantityKg: item.currentAvailableQuantityKg,
    farmerOrderId: item.farmerOrderId
      ? new Types.ObjectId(item.farmerOrderId)
      : null,
    farmerID: new Types.ObjectId(item.farmerID),
    farmerName: item.farmerName,
    farmName: item.farmName,
    status: item.status ?? "active",
  };

  const updated = await AvailableMarketStockModel.findByIdAndUpdate(
    docId,
    { $push: { items: payload } },
    { new: true }
  );

  const newLine = (updated as any)?.items?.at?.(-1);
  if (newLine?._id) console.log("new lineId:", newLine._id.toString());
  return updated;
}

export async function updateItemQtyStatusAtomic(params: {
  docId: string;
  lineId: string;
  currentAvailableQuantityKg?: number;
  status?: "active" | "soldout" | "removed";
}) {
  const { docId, lineId, currentAvailableQuantityKg, status } = params;

  const doc = await AvailableMarketStockModel.findById(docId);
  if (!doc) throw new Error("AvailableMarketStock not found");

  const line = (doc as any).items.id(lineId);
  if (!line) throw new Error("Line item not found");

  if (typeof currentAvailableQuantityKg === "number") {
    if (currentAvailableQuantityKg < 0)
      throw new Error("Quantity cannot be negative");
    if (currentAvailableQuantityKg > line.originalCommittedQuantityKg) {
      throw new Error("Exceeds original committed quantity");
    }
    line.currentAvailableQuantityKg = currentAvailableQuantityKg;
  }
  if (status) line.status = status;

  await doc.save();
  return doc;
}

export async function removeItemFromAvailableMarketStock(params: {
  docId: string;
  lineId: string;
}) {
  const { docId, lineId } = params;

  const updated = await AvailableMarketStockModel.findByIdAndUpdate(
    docId,
    { $pull: { items: { _id: new Types.ObjectId(lineId) } } },
    { new: true }
  );
  return updated;
}
