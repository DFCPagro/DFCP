import type { Request, Response } from "express";
import { ShipmentService } from "../services/shipment.service";
import ApiError from "../utils/ApiError";

/**
 * Return shipments assigned to the authenticated driver with container scan status.
 */
export async function listMyShipments(req: Request, res: Response) {
  // @ts-expect-error - populated by authenticate middleware
  const user = req.user;
  const data = await ShipmentService.listByDriver(user.id);
  res.json({ items: data });
}

/**
 * Driver scanning a container within a shipment. Expects :id = shipmentId and body.barcode.
 */
export async function scanContainer(req: Request, res: Response) {
  // @ts-expect-error - populated by authenticate middleware
  const user = req.user;
  const { id } = req.params;
  const { barcode } = req.body || {};
  if (!barcode) throw new ApiError(400, "barcode required");
  const result = await ShipmentService.scanContainer(user.id, id, barcode);
  res.json(result);
}

/**
 * Create (or refresh) an arrival token for a shipment. Only drivers/logistics roles might call this.
 */
export async function mintArrivalToken(req: Request, res: Response) {
  const { id } = req.params;
  const ttlDays = req.query.ttlDays ? Number(req.query.ttlDays) : 1;
  const data = await ShipmentService.createArrivalToken(id, ttlDays);
  res.json(data);
}

/**
 * Confirm arrival via a scanned token. Public; token in path.
 */
export async function confirmArrivalByToken(req: Request, res: Response) {
  const { token } = req.params;
  const result = await ShipmentService.confirmArrivalByToken(token);
  res.json(result);
}
