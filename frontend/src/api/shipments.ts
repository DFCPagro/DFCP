import { api } from './config';

export type ShipmentContainerView = {
  id: string;
  barcode: string;
  produceType: string;
  quantity: number;
  scanned: boolean;
};

export type ShipmentView = {
  id: string;
  status: string;
  containers: ShipmentContainerView[];
  arrivalToken?: string;
  arrivalUrl?: string;
  arrivalUsedAt?: string;
  arrivalExpiresAt?: string;
};

export type ShipmentsResponse = { items: ShipmentView[] };

export async function fetchDriverShipments() {
  const { data } = await api.get<ShipmentsResponse>('/shipments/me');
  return data;
}

export async function scanShipmentContainer(shipmentId: string, barcode: string) {
  const { data } = await api.post(`/shipments/${shipmentId}/scan`, { barcode });
  return data as { total: number; scanned: number };
}

export async function mintArrivalToken(shipmentId: string, ttlDays?: number) {
  const { data } = await api.post(`/shipments/${shipmentId}/arrival-token`, null, { params: { ttlDays } });
  return data as { token: string; url: string; expiresAt: string };
}

export async function confirmArrival(token: string) {
  const { data } = await api.post(`/shipments/arrival/${token}`);
  return data;
}