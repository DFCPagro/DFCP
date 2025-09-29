import type { AppAddress, Measurements } from "./jobApplications";
// --- UI Land shape used by the form (now supports measurements) ---
export type LandInput = {
  landName: string;                    // UI label; you can also mirror to "name" later
  ownership: "Owned" | "Rented";       // UI casing; you normalize at submit if needed
  acres?: number;                      // still allowed for now (legacy)
  // string displays for inputs (current UI)
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  location?: string;
  locLat?: number;
  locLng?: number;

  // NEW: structured address copies (match backend keys)
  addressObj?: AppAddress;             // { alt, lnt, address }
  pickupAddressObj?: AppAddress | null;

  // NEW: explicit side lengths to satisfy MeasurementsSchema
  measurements?: Measurements;         // { abM, bcM, cdM, daM, rotationDeg? }
};