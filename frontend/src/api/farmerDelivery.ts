// src/api/farmerDelivery.ts
import { api } from "./config"

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type ShiftName = "morning" | "afternoon" | "evening" | "night"

export type FarmerDeliveryShiftSummary = {
  date: string // "YYYY-MM-DD"
  shift: ShiftName
  farmerOrdersCount: number
  deliveriesCount: number
  activeDeliverersCount: number // stubbed 10–17 from backend
  hasPlan: boolean
}

// You can expand this later to match the full model.
// For now, keep it minimal so FE can render stops & meta.
export type FarmerDeliveryStopDTO = {
  type: "pickup" | "dropoff"
  label: string
  sequence: number

  farmerId: string
  farmerName: string
  farmName: string
  farmerOrderIds: string[]

  expectedContainers: number
  expectedWeightKg: number

  plannedAt: string | Date
  arrivedAt?: string | Date | null
  departedAt?: string | Date | null
}

export type FarmerDeliveryDTO = {
  _id: string
  delivererId: string | null
  logisticCenterId: string
  pickUpDate: string
  shift: ShiftName

  shiftStartAt?: string | Date | null
  plannedStartAt?: string | Date | null
  plannedEndAt?: string | Date | null

  totalExpectedContainers?: number
  totalLoadedContainers?: number
  totalExpectedWeightKg?: number
  totalLoadedWeightKg?: number

  stops: FarmerDeliveryStopDTO[]

  stageKey?: string | null
  createdAt?: string | Date
  updatedAt?: string | Date
}

// ⬇️ simplified – backend now infers LC + address from auth context
export type PlanFarmerDeliveriesPayload = {
  pickUpDate: string // "YYYY-MM-DD"
  shift: ShiftName
}

/* -------------------------------------------------------------------------- */
/*                                Constants                                   */
/* -------------------------------------------------------------------------- */

const BASE = "/farmer-delivery"

/* -------------------------------------------------------------------------- */
/*                            API: Dashboard summary                           */
/* -------------------------------------------------------------------------- */

/**
 * T-manager dashboard:
 * Get summary for current + next shifts.
 *
 * By default: backend returns ~6 rows (current + next 5),
 * but you can override with `count`.
 */
export async function getFarmerDeliveryDashboardSummary(params: {
  count?: number
  signal?: AbortSignal
}): Promise<FarmerDeliveryShiftSummary[]> {
  const { count, signal } = params

  const query: Record<string, any> = {}
  if (typeof count === "number") query.count = count

  const res = await api.get(`${BASE}/summary`, {
    params: query,
    signal,
  })

  // controller returns: { data: FarmerDeliveryShiftSummary[] }
  return res.data?.data ?? []
}

/* -------------------------------------------------------------------------- */
/*                           API: Ensure / create plan                         */
/* -------------------------------------------------------------------------- */

/**
 * Ensure there is a FarmerDelivery plan for a given date+shift.
 *
 * - If a plan already exists → backend returns created=false and existing deliveries.
 * - If not → backend creates a new plan and returns created=true and new deliveries.
 *
 * LC id + address are inferred by backend from the authenticated user/context.
 */
export async function planFarmerDeliveriesForShift(params: {
  payload: PlanFarmerDeliveriesPayload
  signal?: AbortSignal
}): Promise<{ created: boolean; deliveries: FarmerDeliveryDTO[] }> {
  const { payload, signal } = params

  const res = await api.post(`${BASE}/plan`, payload, { signal })

  // controller: { created, data: deliveries[] }
  return {
    created: Boolean(res.data?.created),
    deliveries: (res.data?.data ?? []) as FarmerDeliveryDTO[],
  }
}

/* -------------------------------------------------------------------------- */
/*                       API: Get deliveries for one shift                     */
/* -------------------------------------------------------------------------- */

/**
 * When T-manager clicks "View" for a row:
 * Fetch all FarmerDelivery docs for that date+shift.
 */
export async function getFarmerDeliveriesByShift(params: {
  pickUpDate: string // "YYYY-MM-DD"
  shift: ShiftName
  signal?: AbortSignal
}): Promise<FarmerDeliveryDTO[]> {
  const { pickUpDate, shift, signal } = params

  const res = await api.get(`${BASE}/by-shift`, {
    params: { pickUpDate, shift },
    signal,
  })

  // controller: { data: deliveries[] }
  return res.data?.data ?? []
}
