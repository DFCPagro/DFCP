// services/qrService.ts
import crypto from 'crypto';
import QrToken from '../models/QrToken.model';
import Order from '../models/order.model';

const randToken = () => crypto.randomBytes(24).toString('base64url'); // 192-bit

export async function mintOrderQrs(orderId: string, customerTtlDays = 30) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');

  const [opsToken, customerToken] = await Promise.all([
    QrToken.create({ order: order._id, purpose: 'ops', token: randToken() }),
    QrToken.create({
      order: order._id,
      purpose: 'customer',
      token: randToken(),
      expiresAt: new Date(Date.now() + customerTtlDays * 86400_000),
    })
  ]);

  return {
    opsUrl: `${process.env.PUBLIC_APP_URL}/o/${opsToken.token}`,
    customerUrl: `${process.env.PUBLIC_APP_URL}/r/${customerToken.token}`,
    opsToken: opsToken.token,
    customerToken: customerToken.token,
  };
}
