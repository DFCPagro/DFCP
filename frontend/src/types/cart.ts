export type ShiftKey = "morning" | "afternoon" | "night"|"evening";


export interface CartItem {
id: string; // product id
name: string;
imageUrl: string;
pricePerKg: number;
qtyKg: number; // held quantity in kg
farmerName?: string;
holdId?: string; // backend hold _id (for release)
holdExpiresAt: number; // epoch ms
lcId: string; // logistics center lock
shiftKey: ShiftKey; // delivery shift lock
}


export interface CartState {
items: CartItem[];
lcId: string | null;
shiftKey: ShiftKey | null;
}