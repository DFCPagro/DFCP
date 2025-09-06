import { api } from "./config";

export type ScheduleBitmask = number[];

export type LandInput = {
  landName: string;
  ownership: "Owned" | "Rented";
  acres?: number;
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  location?: string;
  locLat?: number;
  locLng?: number;
};

export type EmploymentApplicationPayload = {
  role: string;
  certifyAccuracy: boolean;
  submittedAt: string; // ISO
  extraFields: Record<string, unknown> & {
    scheduleBitmask?: ScheduleBitmask;
    lands?: LandInput[];
    agreementPercentage?: number;
  };
};

export async function submitEmploymentApplication(payload: EmploymentApplicationPayload) {
  const { data } = await api.post("/auth/register-employee", payload);
  return data as { message?: string };
}
