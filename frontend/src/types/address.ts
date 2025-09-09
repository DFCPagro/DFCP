export type Address = {
  // match the backend exactly:
  lnt: number;     // longitude
  alt: number;     // latitude
  address: string; // full address text
};