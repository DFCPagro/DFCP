import { Types } from 'mongoose';
import User from '../../../src/models/user.model';
import Order, { ORDER_STATUSES, IOrder } from '../../../src/models/order.model';
import QrToken from '../../../src/models/QrToken.model';
import {PUBLIC_APP_URL} from "../../../src/config/env"
// config
const DEFAULT_NUM_ORDERS = 15;
const CUSTOMER_QR_TTL_DAYS = 30;

// sample products
const PRODUCTS = [
  { id: 'tomato',  units: 'kg' as const },
  { id: 'cucumber',units: 'kg' as const },
  { id: 'potato',  units: 'kg' as const },
  { id: 'onion',   units: 'kg' as const },
  { id: 'lettuce', units: 'pcs' as const },
  { id: 'carrot',  units: 'kg' as const },
  { id: 'pepper',  units: 'kg' as const },
] as const;

// helpers
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]) => arr[rand(0, arr.length - 1)];
const many = <T>(arr: readonly T[], n: number) => {
  const copy = [...arr]; const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) out.push(copy.splice(rand(0, copy.length - 1), 1)[0]);
  return out;
};
const base64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const makeToken = (bytes = 24) => base64url(require('crypto').randomBytes(bytes));

// lean types
type LeanUser = { _id: Types.ObjectId; name: string; email: string; };

export async function seedOrders(count = DEFAULT_NUM_ORDERS) {
  console.log(`🌱 Seeding ${count} orders…`);

  const consumers = await User.find({ role: 'consumer' }).select('_id name email').lean<LeanUser[]>();
  const drivers   = await User.find({ role: 'driver'   }).select('_id name email').lean<LeanUser[]>();

  if (consumers.length === 0) throw new Error('No consumers found. Run users seeder first.');
  if (drivers.length === 0)   console.warn('⚠️ No drivers found. Orders will be unassigned.');

  // Clean collections (dev)
  await Promise.all([Order.deleteMany({}), QrToken.deleteMany({})]);
  console.log('🧹 Cleared Order + QrToken collections.');

  const now = new Date();

  for (let i = 0; i < count; i++) {
    const consumer = pick(consumers);
    const maybeDriver = drivers.length && Math.random() < 0.7 ? pick(drivers) : null;

    const items = many(PRODUCTS, rand(1, 4)).map((p) => ({
      productId: p.id,
      quantity: p.units === 'pcs' ? rand(1, 10) : rand(5, 50) * 10,
    }));

    const deliverySlot = new Date(now.getTime() + rand(-3, 7) * 24 * 60 * 60 * 1000);
    const status: IOrder['status'] = pick(ORDER_STATUSES);
    const orderId = `X-${now.getFullYear()}-${String(i + 1).padStart(6, '0')}`;

    const order = await Order.create({
      orderId,
      consumerId: consumer._id,                          // ✅ typed ObjectId
      assignedDriverId: maybeDriver ? maybeDriver._id : undefined,
      status,
      deliverySlot,
      items,
    });

    const opsToken = await QrToken.create({
      order: order._id,
      purpose: 'ops',
      token: makeToken(),
    });

    const customerToken = await QrToken.create({
      order: order._id,
      purpose: 'customer',
      token: makeToken(),
      expiresAt: new Date(Date.now() + CUSTOMER_QR_TTL_DAYS * 86400_000),
    });

    if (status === 'confirmed') {
      await QrToken.updateOne({ _id: customerToken._id }, { $set: { usedAt: new Date() } });
    }

    const opsUrl = `${PUBLIC_APP_URL}/o/${opsToken.token}`;
    const customerUrl = `${PUBLIC_APP_URL}/r/${customerToken.token}`;
    console.log(
      `✅ Order ${order.orderId} for ${consumer.email} ` +
      `${maybeDriver ? `(driver ${maybeDriver.email})` : '(unassigned)'} — ` +
      `status=${status} | OPS QR: ${opsUrl} | CUS QR: ${customerUrl}`
    );
  }

  console.log('✅ Orders + QR tokens seeded.');
}
