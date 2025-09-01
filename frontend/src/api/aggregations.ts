import { api } from './config';
import type { IAggregationItem } from '@/types/aggregations';

export type AggregationResponse = {
  items: Array<{
    id: string;
    items: IAggregationItem[];
    containers: string[];
    token: string;
    expiresAt?: string;
    createdAt: string;
  }>;
};

export async function fetchAggregations() {
  const { data } = await api.get<AggregationResponse>('/aggregations');
  return data;
}

export async function createAggregation(payload: { items: IAggregationItem[]; ttlDays?: number }) {
  const { data } = await api.post('/aggregations', payload);
  return data as { id: string; token: string; url: string; expiresAt?: string; items: IAggregationItem[] };
}

export async function getAggregationByToken(token: string) {
  const { data } = await api.get(`/aggregations/${token}`);
  return data;
}