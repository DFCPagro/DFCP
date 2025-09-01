import { Types } from 'mongoose';
import Aggregation, { IAggregationItem } from '../models/aggregation.model';
import QrToken from '../models/QrToken.model';
import { randToken } from '../utils/crypto';
import { PUBLIC_APP_URL } from '../config/env';
import { withOptionalTxn } from '../utils/txn';
import { BadRequestError, NotFoundError } from './order.service';

export type CreateAggregationInput = {
  items: IAggregationItem[];
  ttlDays?: number;
};

export type AggregationResult = {
  id: string;
  token: string;
  url: string;
  expiresAt?: Date;
  items: IAggregationItem[];
};

/**
 * Service methods for aggregations. These functions encapsulate business
 * rules around farmer batch creation and lookup while ensuring
 * transactional safety when multiple collections are involved.
 */
export const AggregationService = {
  /**
   * Create a new aggregation for the given farmer and mint a QR token. Items
   * must be non‑empty and each must have a produceType and positive quantity.
   */
  async createAggregation(farmerId: string, input: CreateAggregationInput): Promise<AggregationResult> {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestError('Aggregation must contain at least one item');
    }
    input.items.forEach((it) => {
      if (!it.produceType) throw new BadRequestError('Item.produceType required');
      if (typeof it.quantity !== 'number' || !(it.quantity > 0)) {
        throw new BadRequestError('Item.quantity must be a positive number');
      }
    });

    const ttlDays = input.ttlDays ?? 7;

    return withOptionalTxn(async (session) => {
      // generate random token for aggregation
      const token = randToken();
      const expiresAt = new Date(Date.now() + ttlDays * 86400_000);

      const agg = await Aggregation.create([
        {
          farmerId: new Types.ObjectId(farmerId),
          items: input.items,
          token,
          expiresAt,
        },
      ], session ? { session } : {}).then((r) => r[0]);

      // Create corresponding QR token to enable external scanning/lookup
      await QrToken.create([
        {
          aggregation: agg._id,
          purpose: 'aggregation',
          token,
          expiresAt,
        },
      ], session ? { session } : {});

      const url = `${PUBLIC_APP_URL}/ag/${token}`;
      return { id: String(agg._id), token, url, expiresAt, items: agg.items };
    });
  },

  /**
   * Fetch an aggregation by its token. Throws NotFoundError if invalid or
   * expired. Does not increment any usage counters; consumption is handled
   * externally.
   */
  async getByToken(token: string) {
    const qr = await QrToken.findOne({ token, purpose: 'aggregation' }).lean();
    if (!qr) throw new NotFoundError('Invalid aggregation token');
    if (qr.expiresAt && qr.expiresAt < new Date()) {
      throw new BadRequestError('Aggregation token expired');
    }
    const agg = await Aggregation.findById(qr.aggregation).lean();
    if (!agg) throw new NotFoundError('Aggregation not found');
    return {
      id: String(agg._id),
      farmerId: String(agg.farmerId),
      items: agg.items,
      containers: agg.containers?.map(String) ?? [],
      createdAt: agg.createdAt,
      expiresAt: agg.expiresAt,
    };
  },

  /** List aggregations for a given farmer */
  async listByFarmer(farmerId: string) {
    const aggs = await Aggregation.find({ farmerId: new Types.ObjectId(farmerId) }).lean();
    return aggs.map((a) => ({
      id: String(a._id),
      items: a.items,
      containers: a.containers?.map(String) ?? [],
      token: a.token,
      expiresAt: a.expiresAt,
      createdAt: a.createdAt,
    }));
  },
};