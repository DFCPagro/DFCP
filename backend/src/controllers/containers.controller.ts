import type { Request, Response } from "express";
import { ContainerService } from "../services/container.service";
import { PUBLIC_APP_URL } from "../config/env";

/**
 * Create a new container reported by the authenticated farmer.
 * Optionally link to an aggregation.
 */
export async function createContainer(req: Request, res: Response) {
  // @ts-expect-error – populated by authenticate middleware
  const user = req.user;
  const payload = req.body || {};
  const result = await ContainerService.createContainer(user.id, payload);

  // include a URL for the QR code for convenience
  res.status(201).json({
    ...result,
    url: `${PUBLIC_APP_URL}/c/${result.barcode}`,
  });
}

/**
 * List containers reported by the authenticated farmer.
 */
export async function listContainers(req: Request, res: Response) {
  // @ts-expect-error – populated by authenticate middleware
  const user = req.user;
  const data = await ContainerService.listByFarmer(user.id);
  res.json({ items: data });
}

/**
 * Public endpoint to fetch container details by its barcode.
 * Useful for driver/logistics scanning.
 */
export async function getContainerByBarcode(req: Request, res: Response) {
  const { barcode } = req.params;
  const data = await ContainerService.getByBarcode(barcode);
  res.json(data);
}
