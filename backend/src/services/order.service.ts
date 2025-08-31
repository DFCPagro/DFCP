import { ClientSession, Types } from 'mongoose';
import Order, { IOrder } from '../models/order.model';
import QrToken from '../models/QrToken.model';
import { randToken } from '../utils/crypto';
import { buildQrUrls } from '../utils/urls';
import { withOptionalTxn } from '../utils/txn';
import { ensureValidObjectId, toObjectId } from '../utils/ids';

/* --------------------------- errors --------------------------- */

export class NotFoundError extends Error { status = 404; }
export class ConflictError extends Error { status = 409; }
export class GoneError extends Error { status = 410; }
export class BadRequestError extends Error { status = 400; }

/* ---------------------------- DTOs ---------------------------- */

export type ApiOrderItem = {
  productId: string;
  quantity: number;
  sourceFarmerId?: string;
};

export type CreateOrderInput = {
  orderId?: string;
  consumerId: string;
  assignedDriverId?: string;
  status?: string;
  deliverySlot?: Date;
  items: ApiOrderItem[];
};

export type CreateOrderResult = {
  order: IOrder; // hydrated
  opsUrl: string;
  customerUrl: string;
  opsToken: string;
  customerToken: string;
};

export type MintResult = {
  opsUrl: string;
  customerUrl: string;
  opsToken: string;
  customerToken: string;
};

export type PaginatedOrders = {
  page: number;
  pageSize: number;
  total: number;
  items: Array<{
    id: string;
    orderId: string;
    status: string;
    deliverySlot?: Date | null;
    createdAt: Date;
    items: IOrder['items'];
  }>;
};

export type OrderView = {
  id: string;
  orderId: string;
  consumerId: string;
  assignedDriverId: string | null;
  status: string;
  deliverySlot?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: IOrder['items'];
};

/* --------------------------- service -------------------------- */

export const OrderService = {
  /** Create an order and mint two QR tokens. */
  async createOrderWithQrs(input: CreateOrderInput): Promise<CreateOrderResult> {
    validateOrderItems(input.items);

    const orderDoc = {
      orderId: input.orderId,
      consumerId: toObjectId(input.consumerId) as Types.ObjectId,
      assignedDriverId: toObjectId(input.assignedDriverId),
      status: input.status, // model default 'created' if undefined
      deliverySlot: input.deliverySlot,
      items: input.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        sourceFarmerId: toObjectId(it.sourceFarmerId),
      })),
    };

    return withOptionalTxn(async (session) => {
      // ensure collection exists (no-op if already there)
      await Order.createCollection().catch(() => {});
      const order = await Order.create([orderDoc], session ? { session } : {}).then(r => r[0]);

      const [opsTok, cusTok] = await Promise.all([
        QrToken.create([{ order: order._id, purpose: 'ops', token: randToken() }], session ? { session } : {}).then(r => r[0]),
        QrToken.create([{
          order: order._id, purpose: 'customer', token: randToken(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }], session ? { session } : {}).then(r => r[0]),
      ]);

      const { opsUrl, customerUrl } = buildQrUrls(opsTok.token, cusTok.token);
      return { order, opsUrl, customerUrl, opsToken: opsTok.token, customerToken: cusTok.token };
    });
  },

  /** List orders with pagination. */
  async listOrders({ page, pageSize }: { page: number; pageSize: number }): Promise<PaginatedOrders> {
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      Order.find().sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
      Order.countDocuments(),
    ]);

    return {
      page,
      pageSize,
      total,
      items: items.map((o: any) => ({
        id: String(o._id),
        orderId: o.orderId ?? String(o._id),
        status: o.status,
        deliverySlot: o.deliverySlot ?? null,
        createdAt: o.createdAt,
        items: o.items,
      })),
    };
  },

  /** Get single order by id with validation. */
  async getOrderById(id: string): Promise<OrderView> {
    ensureValidObjectId(id, 'order id');
    const o = await Order.findById(id).lean();
    if (!o) throw new NotFoundError('Order not found');

    return {
      id: String(o._id),
      orderId: (o as any).orderId ?? String(o._id),
      consumerId: String((o as any).consumerId),
      assignedDriverId: (o as any).assignedDriverId ? String((o as any).assignedDriverId) : null,
      status: (o as any).status,
      deliverySlot: (o as any).deliverySlot ?? null,
      createdAt: (o as any).createdAt,
      updatedAt: (o as any).updatedAt,
      items: (o as any).items,
    };
  },

  /** Update status of an order (with id validation). */
  async updateOrderStatus(id: string, status: string) {
    ensureValidObjectId(id, 'order id');
    const o = await Order.findByIdAndUpdate(id, { $set: { status } }, { new: true });
    if (!o) throw new NotFoundError('Order not found');
    return { id: o.id, status: o.status };
  },

  /** (Re)mint QR tokens for an existing order. */
  async mintQrsForOrder(orderId: string, customerTtlDays = 30, session?: ClientSession): Promise<MintResult> {
    ensureValidObjectId(orderId, 'order id');

    const order = await Order.findById(orderId).session(session || null);
    if (!order) throw new NotFoundError('Order not found');

    const [opsTok, cusTok] = await Promise.all([
      QrToken.create([{ order: order._id, purpose: 'ops', token: randToken() }], { session }).then(r => r[0]),
      QrToken.create([{
        order: order._id, purpose: 'customer', token: randToken(),
        expiresAt: new Date(Date.now() + customerTtlDays * 86400_000),
      }], { session }).then(r => r[0]),
    ]);

    const { opsUrl, customerUrl } = buildQrUrls(opsTok.token, cusTok.token);
    return { opsUrl, customerUrl, opsToken: opsTok.token, customerToken: cusTok.token };
  },

  /** Optional helper to revoke a customer token. */
  async revokeCustomerToken(token: string) {
    const t = await QrToken.findOne({ token, purpose: 'customer' });
    if (!t) throw new NotFoundError('Token not found');
    await QrToken.deleteOne({ _id: t._id });
    return { ok: true };
  },

  /** Read-only order details via ops token. */
  async getOrderByOpsToken(token: string) {
    const t = await QrToken.findOne({ token, purpose: 'ops' }).lean();
    if (!t) throw new NotFoundError('Invalid token');

    const order = await Order.findById(t.order).lean();
    if (!order) throw new NotFoundError('Order not found');

    return {
      orderNo: (order as any).orderId ?? String(order._id),
      status: (order as any).status,
      items: (order as any).items,
      deliverySlot: (order as any).deliverySlot,
      createdAt: (order as any).createdAt,
    };
  },

  /** Confirm delivery via customer token (one-time). */
  async confirmByCustomerToken(token: string, review?: { rating?: number; comment?: string }) {
    return withOptionalTxn(async (session) => {
      const t = await QrToken.findOne({ token, purpose: 'customer' }).session(session || null);
      if (!t) throw new NotFoundError('Invalid token');
      if (t.expiresAt && t.expiresAt < new Date()) throw new GoneError('Code expired');
      if (t.usedAt) throw new ConflictError('Already confirmed');

      const order = await Order.findById(t.order).session(session || null);
      if (!order) throw new NotFoundError('Order not found');

      order.status = 'confirmed';
      await order.save(session ? { session } : {});

      t.usedAt = new Date();
      await t.save(session ? { session } : {});

      // if (review?.rating) await Review.create([{ order: order._id, ...review }], session ? { session } : {});

      return { ok: true, orderNo: order.orderId ?? order.id };
    });
  },
};

/* ------------------------- validation -------------------------- */
function validateOrderItems(items: ApiOrderItem[] | undefined): asserts items is ApiOrderItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestError('Order must contain at least one item');
  }
  for (const it of items) {
    if (!it.productId) throw new BadRequestError('Item.productId required');
    if (typeof it.quantity !== 'number' || !(it.quantity > 0)) {
      throw new BadRequestError('Item.quantity must be a positive number');
    }
    if (it.sourceFarmerId !== undefined && typeof it.sourceFarmerId !== 'string') {
      throw new BadRequestError('Item.sourceFarmerId must be a string');
    }
  }
}
