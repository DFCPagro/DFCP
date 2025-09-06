import type { Request, Response } from "express";
import { AggregationService } from "../services/aggregation.service";

/**
 * Create a new aggregation for the authenticated farmer.
 * Body must include a non-empty `items` array with produceType and quantity.
 */
export async function createAggregation(req: Request, res: Response) {
  // @ts-expect-error – populated by authenticate middleware
  const user = req.user;
  const { items, ttlDays } = req.body || {};
  const result = await AggregationService.createAggregation(user.id, {
    items,
    ttlDays,
  });
  res.status(201).json(result);
}

/**
 * List aggregations created by the authenticated farmer.
 */
export async function listAggregations(req: Request, res: Response) {
  // @ts-expect-error – populated by authenticate middleware
  const user = req.user;
  const data = await AggregationService.listByFarmer(user.id);
  res.json({ items: data });
}

/**
 * Public endpoint to fetch aggregation details via its token. No auth required.
 */
export async function getAggregationByToken(req: Request, res: Response) {
  const { token } = req.params;
  const agg = await AggregationService.getByToken(token);
  res.json(agg);
}
