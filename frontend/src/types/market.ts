export type ShiftCode = "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";
export type CategoryCode = "VEGETABLES" | "FRUITS" | "EGGS" | "DAIRY";


export interface UserLocation {
  _id: string;
  label: string;        // "Home – 22 Ben Gurion St"
  street: string;
  city: string;
  lat?: number;
  lng?: number;
    logisticCenterId?: string; // ← NEW: where this address is served from

}

export interface ShiftOption {
   code: ShiftCode;
  label: string;
  remainingSkus: number;
  isOpenNow: boolean;
}

export interface FarmerInfo {
  _id: string;
  name: string;         // "Levy Cohen"
  farmName: string;     // "Green Valley"
}

export interface MarketItem {
  _id: string;              // productId (catalog id)
  inventoryId: string;      // ← NEW: LC-Shift-productId
  name: string;
  price: number;
  stock: number;
  inStock: number;
  imageUrl: string;
  farmer: { _id: string; name: string; farmName: string };
  category: CategoryCode;
}

export interface MarketQuery {
locationId: string;
  shift: ShiftCode;
  category?: CategoryCode | "ALL";
}

