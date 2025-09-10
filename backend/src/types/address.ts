export interface Address {
  label: string;        // "Home", "Work", "Farm"
  address: string;      // free-form
  lnt: number;          // longitude
  alt: number;          // latitude
  isPrimary?: boolean;  // only one per user
}
