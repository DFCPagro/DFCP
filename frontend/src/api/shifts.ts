// src/api/shifts.ts
import { api } from "@/api/config";

// --- Types ---
export type ShiftName = "morning" | "afternoon" | "evening" | "night" | "none";

export interface CurrentShiftResp {
  shift: ShiftName;
}

export interface NextShift {
  date: string; // "yyyy-LL-dd"
  name: ShiftName;
}

// --- API Calls ---

/**
 * Get the currently active shift.
 * @returns The active shift name.
 */
export async function fetchCurrentShift(): Promise<CurrentShiftResp> {
  const res = await api.get<{ data: CurrentShiftResp }>("/shifts/current");

  if (!res.data?.data) throw new Error("Failed to load current shift");
  return res.data.data;
}

/**
 * Get the next N available shifts for a given logistic center.
 * @param logisticCenterId - LC id (required)
 * @param count - How many shifts ahead (default: 5)
 */
export async function fetchNextShifts(
  logisticCenterId: string,
  count = 5
): Promise<NextShift[]> {
  const res = await api.get<NextShift[]>("/shifts/next", {
    params: { lc: logisticCenterId, count },
  });

  if (!Array.isArray(res.data)) throw new Error("Failed to load next shifts");
  return res.data;
}

/**
 * Get all shift windows for a given logistic center.
 * Each item includes the normalized windows for general, deliverer, etc.
 */
export async function fetchShiftWindows() {
  const res = await api.get("/shifts/windows/all");
  if (!res.data) throw new Error("Failed to load shift windows");
  return res.data;
}

export async function fetchShiftWindowsByName(name: ShiftName) {
  const res = await api.get("/shifts/windows", {
    params: { name },
  });
  if (!res.data) throw new Error("Failed to load shift windows");
  return res.data;
}
