import { api } from './config';
import type { Container } from '@/types/containers';

export type ContainerListResponse = { items: Container[] };

export async function fetchContainers() {
  const { data } = await api.get<ContainerListResponse>('/containers');
  return data;
}

export async function createContainer(payload: { produceType: string; quantity: number; weight?: number; qualityGrade?: string; aggregationId?: string; }) {
  const { data } = await api.post('/containers', payload);
  return data;
}

export async function getContainerByBarcode(barcode: string) {
  const { data } = await api.get(`/containers/${barcode}`);
  return data;
}