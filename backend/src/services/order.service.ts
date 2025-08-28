import mongoose, { ClientSession, Types } from 'mongoose';
import Order, { IOrder } from '../models/order.model';
import QrToken from '../models/QrToken.model';

const APP_URL = process.env.PUBLIC_APP_URL || 'http://localhost:5173';

/* -------------------------- helpers --------------------------- */

const randToken = () => cryptoRandom(24); // ~192-bit base64url

function cryptoRandom(bytes: number) {
  const nodeCrypto = (global as any).crypto ?? require('crypto');
  if (nodeCrypto?.webcrypto?.getRandomValues) {
    const arr = new Uint8Array(bytes);
    nodeCrypto.webcrypto.getRandomValues(arr);
    return Buffer.from(arr).toString('base64url');
  }
  return require('crypto').randomBytes(bytes).toString('base64url');
}

const toObjectId = (v?: string) => (v ? new Types.ObjectId(v) : undefined);

const buildQrUrls = (opsToken: string, customerToken: string) => ({
  opsUrl: `${APP_URL}/o/${opsToken}`,
  customerUrl: `${APP_URL}/r/${customerToken}`,
});

// Run a function inside a transaction if supported, otherwise without a session
async function withOptionalTxn<T>(fn: (session?: ClientSession) => Promise<T>): Promise<T> {
  let session: ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err: any) {
    if (session) {
      try { await session.abortTransaction(); } catch {}
      session.endSession();
    }
    const msg = String(err?.message || '');
    // Fallback if transactions aren’t supported locally
    if (msg.includes('Transaction numbers are only allowed on a replica set') || err?.code === 20) {
      return fn(undefined);
    }
    throw err;
  } finally {
    if (session) session.endSession();
  }
}

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

/* --------------------------- service -------------------------- */

export const OrderService = {
  /**
   * Create an order and mint two QR tokens.
   * Uses a transaction when available; falls back otherwise.
   */
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

  /** (Re)mint QR tokens for an existing order. */
  async mintQrsForOrder(orderId: string, customerTtlDays = 30, session?: ClientSession): Promise<MintResult> {
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
