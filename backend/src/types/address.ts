import { get } from "http";

export interface Address {
  lnt: number;
  alt: number;
  address: string;
  logisticCenterId?: string; // optional, for deliverers
}

