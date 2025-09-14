// Basic role enum (align with backend swagger)
export type ApplicationRole =
  | "deliverer"
  | "industrialDeliverer"
  | "farmer"
  | "picker"
  | "sorter";

/** Shared fields we always send */
export interface JobApplicationCreateBase {
  appliedRole: ApplicationRole;
  /** Nullable/optional per your backend. Keep as string to allow ObjectId or custom codes if you switch later */
  logisticCenterId?: string | null;
  /** Optional free text (≤ 1000 chars server-side) */
  notes?: string;
  /** E.164 or local 6–30 chars */
  contactEmail?: string | null;
  contactPhone?: string | null;
}

/** ---- Per-role applicationData shapes (minimal examples, extend as needed) ---- */

// Deliverer / Industrial Deliverer (example fields; extend to your actual needs)
export interface DelivererApplicationData {
  vehicleType?: "car" | "van" | "truck" | "bike";
  refrigerated?: boolean;
  capacityKg?: number;
  workRegions?: string[]; // e.g., ["east", "west"]
  licenseNumber?: string;
}

// Farmer (example fields; extend as needed)
export interface FarmerApplicationData {
  farmName?: string;
  address?: {
    address: string;
    city?: string | null;
    lat?: number | null;
    lng?: number | null;
  };
  categories?: string[]; // e.g., ["tomatoes","cucumbers"]
  weeklySupplyKg?: number;
}

// For picker/sorter you can add shapes later
export type GenericApplicationData = Record<string, unknown>;

export type ApplicationDataByRole =
  | DelivererApplicationData
  | FarmerApplicationData
  | GenericApplicationData;

// Payload we send to POST /job-applications
export interface JobApplicationCreateInput extends JobApplicationCreateBase {
  applicationData: ApplicationDataByRole;
}

/** ---- Server DTO (response) ---- */
export interface JobApplicationDTO {
  id: string;
  user:
    | string
    | {
        id: string;
        name?: string | null;
        email?: string | null;
        role?: string | null;
      };
  appliedRole: ApplicationRole;
  logisticCenterId?: string | null;
  status: "pending" | "contacted" | "approved" | "denied";
  applicationData: ApplicationDataByRole;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
