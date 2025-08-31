import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Order from '../models/order.model';
import {
  OrderService,
  NotFoundError,
  ConflictError,
  GoneError,
  BadRequestError,
} from '../services/order.service';

/* ----------------------- validation schemas ----------------------- */
const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  sourceFarmerId: z.string().optional(),
});

const createOrderSchema = z.object({
  orderId: z.string().optional(),
  consumerId: z.string().min(1),
  assignedDriverId: z.string().optional(),
  status: z.string().optional(),
  deliverySlot: z.string().datetime().optional(),
  items: z.array(itemSchema).min(1),
});

const updateStatusSchema = z.object({
  status: z.string().min(1),
});

const confirmSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  comment: z.string().max(2000).optional(),
});

/* ---------------------------- controller -------------------------- */

export const createOrder = async (req: Request, res: Response) => {
  const body = createOrderSchema.parse(req.body);
  const result = await Order.createCollection(); // ensure collection exists (no-op if it does)
  const r = await OrderService.createOrderWithQrs({
    ...body,
    deliverySlot: body.deliverySlot ? new Date(body.deliverySlot) : undefined,
  });

  return res.status(201).json({
    id: r.order.id,
    orderId: r.order.orderId ?? r.order.id,
    status: r.order.status,
    deliverySlot: r.order.deliverySlot,
    items: r.order.items,
    opsUrl: r.opsUrl,
    customerUrl: r.customerUrl,
    // opsToken: r.opsToken,
    // customerToken: r.customerToken,
  });
};

export const listOrders = async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    Order.find().sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    Order.countDocuments(),
  ]);

  return res.json({
    page,
    pageSize,
    total,
    items: items.map((o: any) => ({
      id: String(o._id),
      orderId: o.orderId ?? String(o._id),
      status: o.status,
      deliverySlot: o.deliverySlot,
      createdAt: o.createdAt,
      items: o.items,
    })),
  });
};

export const getOrder = async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }
  const o = await Order.findById(req.params.id).lean();
  if (!o) throw new NotFoundError('Order not found');

  return res.json({
    id: String(o._id),
    orderId: (o as any).orderId ?? String(o._id),
    consumerId: String((o as any).consumerId),
    assignedDriverId: (o as any).assignedDriverId ? String((o as any).assignedDriverId) : null,
    status: (o as any).status,
    deliverySlot: (o as any).deliverySlot,
    createdAt: (o as any).createdAt,
    updatedAt: (o as any).updatedAt,
    items: (o as any).items,
  });
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }
  const { status } = updateStatusSchema.parse(req.body);
  const o = await Order.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
  if (!o) throw new NotFoundError('Order not found');
  return res.json({ id: o.id, status: o.status });
};

export const mintQrs = async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }
  const ttlDays = req.query.ttlDays ? Number(req.query.ttlDays) : 30;
  const r = await OrderService.mintQrsForOrder(req.params.id, ttlDays);
  return res.json(r); // { opsUrl, customerUrl, opsToken, customerToken }
};

export const getByOpsToken = async (req: Request, res: Response) => {
  console.log("req.params.token:" , req.params.token)
  const data = await OrderService.getOrderByOpsToken(req.params.token);
  return res.json(data);
};

export const confirmByCustomerToken = async (req: Request, res: Response) => {
  const body = confirmSchema.parse(req.body ?? {});
  const data = await OrderService.confirmByCustomerToken(req.params.token, body);
  return res.json(data);
};

/* ---------------------- controller-level errors -------------------- */
/* If you don’t want a global error middleware, you can export this: */
export function handleErr(res: Response, e: any) {
  const status =
    e instanceof NotFoundError ? e.status :
    e instanceof ConflictError ? e.status :
    e instanceof GoneError ? e.status :
    e instanceof BadRequestError ? e.status :
    e?.name === 'CastError' ? 400 :
    500;

  return res.status(status).json({ error: e?.message ?? 'Server error' });
}
