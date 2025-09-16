// Basic role enum (align with backend swagger)
export type ApplicationRole =
  | "deliverer"
  | "industrialDeliverer"
  | "farmer"
  | "picker"
  | "sorter";

export type SortParam =
  | "-createdAt"
  | "createdAt"
  | "-updatedAt"
  | "updatedAt"
  | "-status"
  | "status";

  export type JobApplicationStatus =
  | "pending"
  | "contacted"
  | "approved"
  | "denied";


// / Generic pagination envelope
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

// Query params for the admin list endpoint
export interface ListJobApplicationsParams {
  role?: ApplicationRole;
  status?: JobApplicationStatus;
  user?: string;             // applicant user id (ObjectId)
  logisticCenterId?: string; // your backend currently uses ObjectId here
  from?: string | Date;      // createdAt >= from
  to?: string | Date;        // createdAt <= to
  page?: number;             // default: 1
  limit?: number;            // default: 20
  sort?: SortParam;          // default: "-createdAt"
  includeUser?: boolean;     // include user data in DTO
}

// Payload for PATCH /admin/:id/status
export interface PatchStatusPayload {
  status: JobApplicationStatus; // server enforces: pending→contacted/approved/denied; contacted→approved/denied
  reviewerNotes?: string;
  contactedAt?: string | Date;
  approvedAt?: string | Date;
}
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
