export type ShiftCode = "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";

export interface UserLocation {
  _id: string;
  label: string;        // "Home – 22 Ben Gurion St"
  street: string;
  city: string;
  lat?: number;
  lng?: number;
}

export interface ShiftOption {
  code: ShiftCode;
  label: string;        // "Morning (06:00–12:00)"
  remainingSkus: number;
  isOpenNow: boolean;
}

export interface FarmerInfo {
  _id: string;
  name: string;         // "Levy Cohen"
  farmName: string;     // "Green Valley"
}

export interface MarketItem {
  _id: string;          // itemId
  name: string;         // "Apple"
  imageUrl?: string;
  price: number;        // per kg
  inStock: number;      // remaining units for the chosen (location, shift)
  farmer: FarmerInfo;
}

export interface MarketQuery {
  locationId: string;
  shift: ShiftCode;
}
