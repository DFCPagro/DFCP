import mongoose, { Types } from "mongoose";
import Order from "../models/order.model";
import { CreateOrderInput } from "../validations/orders.validation";
import { adjustAvailableQtyAtomic } from "./availableMarketStock.service";
import { addOrderIdToFarmerOrder } from "./farmerOrder.service";
import { AvailableMarketStockModel } from "../models/availableMarketStock.model"; // adjust path if needed


type IdLike = string | Types.ObjectId;
const toOID = (v: IdLike) => (v instanceof Types.ObjectId ? v : new Types.ObjectId(v));

/**
 * Transactional order creation:
 * 1) Read AMS and map lines by farmerOrderId
 * 2) For each order item: decrement that AMS line (reserve) using adjustAvailableQtyAtomic
 * 3) Create Order with immutable item snapshots
 * 4) Link each FarmerOrder to the Order with allocated qty
 */
export async function createOrderForCustomer(userId: IdLike, payload: CreateOrderInput) {
  const session = await mongoose.startSession();

  const customerOID = toOID(userId);
  const amsOID = toOID(payload.amsId);
  const lcOID = toOID(payload.logisticsCenterId);

  let orderDoc: any;

  try {
    await session.withTransaction(async () => {
      // 1) Load AMS doc once (we need to resolve line _id by farmerOrderId)
      const ams = await AvailableMarketStockModel.findById(amsOID, { items: 1 })
        .session(session);
      if (!ams) {
        const err: any = new Error("AvailableMarketStock not found");
        err.name = "NotFound";
        throw err;
      }

      const itemsArr: any[] = Array.isArray((ams as any).items) ? (ams as any).items : [];
      // Build a map: farmerOrderId(string) -> AMS line (expects unique FO per line)
      const byFO = new Map<string, any>();
      for (const line of itemsArr) {
        const foIdStr = line.farmerOrderId ? String(line.farmerOrderId) : "";
        if (foIdStr) {
          // If duplicates exist, last one wins; but that indicates AMS data issue.
          byFO.set(foIdStr, line);
        }
      }

      // 2) Reserve from AMS per requested item
      for (const it of payload.items) {
        const line = byFO.get(String(it.farmerOrderId));
        if (!line || !line._id) {
          const err: any = new Error(`AMS line not found for farmerOrderId ${it.farmerOrderId}`);
          err.name = "BadRequest";
          err.details = ["Ensure AMS has a line whose farmerOrderId matches the requested item."];
          throw err;
        }

        await adjustAvailableQtyAtomic({
          docId: amsOID.toString(),
          lineId: String(line._id), // decrement the exact line
          deltaKg: -it.quantity,
          enforceEnoughForReserve: true,
          session,
        });
      }

      // 3) Create Order document with immutable item snapshots
      [orderDoc] = await Order.create(
        [{
          customerId: customerOID,
          deliveryAddress: payload.deliveryAddress,
          deliveryDate: payload.deliveryDate,
          LogisticsCenterId: lcOID, // keep your field capitalization
          shiftName: ams.availableShift,
          amsId: amsOID,
          items: payload.items.map((it) => ({
            itemId: it.itemId,
            name: it.name,
            imageUrl: it.imageUrl ?? "",
            pricePerUnit: it.pricePerUnit,
            quantity: it.quantity,
            category: it.category ?? "",
            sourceFarmerName: it.sourceFarmerName,
            sourceFarmName: it.sourceFarmName,
            farmerOrderId: toOID(it.farmerOrderId),
          })),
        }],
        { session }
      );

      // 4) Link each FarmerOrder to this Order with allocated qty
      for (const it of payload.items) {
        await addOrderIdToFarmerOrder(orderDoc._id, it.farmerOrderId, it.quantity, { session });
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


/* list of the latest 15 orders */
export async function listOrdersForCustomer(userId: IdLike, limit = 15) {
  const customerOID = toOID(userId);

  const docs = await Order.find({ customerId: customerOID })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(limit, 15))) // cap at 15 as requested
    .lean()
    .exec();

  return docs;
}