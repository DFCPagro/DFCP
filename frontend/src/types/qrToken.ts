// src/types/api.ts

export interface ScanClaims {
  farmerOrderId: string | null;
  farmerDeliveryId: string | null;
  containerId: string | null;
  containerOpsId: string | null;
  orderId: string | null;
  packageId: string | null;
  logisticsCenterId: string | null;
  shelfId: string | null;
  pickTaskId: string | null;
  shift: string | null;
  deliveryDate: string | null;
  customerId: string | null;
}

export interface ScanData {
  ok: boolean;
  token: string;
  scope: string;
  subjectType: string;
  subjectId: string;
  claims: ScanClaims;
  status: string;
  scansCount: number;
}

export interface ScanResponse {
  ok: boolean;
  data: ScanData;
}
