import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { AggregationService } from '../services/aggregation.service';

/**
 * Create a new aggregation for the authenticated farmer.
 * Body must include a non‑empty `items` array with produceType and quantity.
 */
export const createAggregation = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { items, ttlDays } = req.body || {};
  const result = await AggregationService.createAggregation(user.id, { items, ttlDays });
  return res.status(201).json(result);
});

/**
 * List aggregations created by the authenticated farmer.
 */
export const listAggregations = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const data = await AggregationService.listByFarmer(user.id);
  return res.json({ items: data });
});

/**
 * Public endpoint to fetch aggregation details via its token. No auth required.
 */
export const getAggregationByToken = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.params;
  const agg = await AggregationService.getByToken(token);
  return res.json(agg);
});