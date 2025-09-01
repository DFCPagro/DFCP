import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { ContainerService } from '../services/container.service';
import { PUBLIC_APP_URL } from '../config/env';

/**
 * Create a new container reported by the authenticated farmer. Optionally link to an aggregation.
 */
export const createContainer = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const payload = req.body || {};
  const result = await ContainerService.createContainer(user.id, payload);
  // include a URL for the QR code for convenience
  return res.status(201).json({ ...result, url: `${PUBLIC_APP_URL}/c/${result.barcode}` });
});

/**
 * List containers reported by the authenticated farmer.
 */
export const listContainers = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const data = await ContainerService.listByFarmer(user.id);
  return res.json({ items: data });
});

/**
 * Public endpoint to fetch container details by its barcode. Useful for driver/logistics scanning.
 */
export const getContainerByBarcode = catchAsync(async (req: Request, res: Response) => {
  const { barcode } = req.params;
  const data = await ContainerService.getByBarcode(barcode);
  return res.json(data);
});