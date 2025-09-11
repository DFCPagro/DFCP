import { Request, Response } from 'express';
import { z } from 'zod';
import { OrderService } from '../services/order.service';

// transport-level validation
const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  sourceFarmerId: z.string().optional(),
});

const createOrderSchema = z.object({
  orderId: z.string().optional(),
  customerId: z.string().min(1),            // ⬅️ renamed
  assignedDriverId: z.string().optional(),
  status: z.string().optional(),
  deliverySlot: z.string().datetime().optional(),
  items: z.array(itemSchema).min(1),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const updateStatusSchema = z.object({
  status: z.string().min(1),
});

const confirmSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  comment: z.string().max(2000).optional(),
});

/* actions */

export const createOrder = async (req: Request, res: Response) => {
  const body = createOrderSchema.parse(req.body);

  const result = await OrderService.createOrderWithQrs({
    ...body,
    deliverySlot: body.deliverySlot ? new Date(body.deliverySlot) : undefined,
  });

  return res.status(201).json({
    id: result.order.id,
    orderId: result.order.orderId ?? result.order.id,
    customerId: String((result.order as any).customerId), // ⬅️ expose customerId
    status: result.order.status,
    deliverySlot: (result.order as any).deliverySlot,     // your service can also return computed slot if you want
    items: result.order.items,
    opsUrl: result.opsUrl,
    customerUrl: result.customerUrl,
  });
};

export const listOrders = async (req: Request, res: Response) => {
  const { page, pageSize } = listQuerySchema.parse(req.query);
  const data = await OrderService.listOrders({ page, pageSize });
  return res.json(data);
};

export const getOrder = async (req: Request, res: Response) => {
  const data = await OrderService.getOrderById(req.params.id);
  return res.json(data);
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  const { status } = updateStatusSchema.parse(req.body);
  const data = await OrderService.updateOrderStatus(req.params.id, status);
  return res.json(data);
};

export const mintQrs = async (req: Request, res: Response) => {
  const ttlDays = req.query.ttlDays ? Number(req.query.ttlDays) : 30;
  const data = await OrderService.mintQrsForOrder(req.params.id, ttlDays);
  return res.json(data);
};

export const getByOpsToken = async (req: Request, res: Response) => {
  const data = await OrderService.getOrderByOpsToken(req.params.token);
  return res.json(data);
};

export const confirmByCustomerToken = async (req: Request, res: Response) => {
  const body = confirmSchema.parse(req.body ?? {});
  const data = await OrderService.confirmByCustomerToken(req.params.token, body);
  return res.json(data);
};
