import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { ShipmentService } from '../services/shipment.service';

/**
 * Return shipments assigned to the authenticated driver with container scan status.
 */
export const listMyShipments = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const data = await ShipmentService.listByDriver(user.id);
  return res.json({ items: data });
});

/**
 * Driver scanning a container within a shipment. Expects :id = shipmentId and body.barcode.
 */
export const scanContainer = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { barcode } = req.body || {};
  if (!barcode) throw new Error('barcode required');
  const result = await ShipmentService.scanContainer(user.id, id, barcode);
  return res.json(result);
});

/**
 * Create (or refresh) an arrival token for a shipment. Only drivers/logistics roles might call this.
 */
export const mintArrivalToken = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const ttlDays = req.query.ttlDays ? Number(req.query.ttlDays) : 1;
  const data = await ShipmentService.createArrivalToken(id, ttlDays);
  return res.json(data);
});

/**
 * Confirm arrival via a scanned token. Public; token in path.
 */
export const confirmArrivalByToken = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.params;
  const result = await ShipmentService.confirmArrivalByToken(token);
  return res.json(result);
});