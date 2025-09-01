export type Container = {
  id: string;
  produceType: string;
  quantity: number;
  weight?: number;
  qualityGrade?: string;
  barcode: string;
  aggregationId?: string;
  scannedBy?: string;
  scannedAt?: string;
  url?: string;
};