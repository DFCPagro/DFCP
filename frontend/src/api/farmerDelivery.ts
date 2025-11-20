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

export type FarmerDeliveryStopDTO = {
  type: "pickup" | "dropoff"
  label: string
  sequence: number

  farmerId: string
  farmerName: string
  farmName: string
  farmerOrderIds: string[]

  // ESTIMATED (from planning / forecast)
  expectedContainers: number
  expectedWeightKg: number

  // CURRENT (from scans / loaded containers)
  loadedContainersCount?: number
  loadedWeightKg?: number

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

// 🔹 NEW: per-FO container estimates from /plan
export type ContainerEstimatePerOrderDTO = {
  farmerOrderId: string
  itemId: string
  itemName: string
  estimatedContainers: number       // from forecast qty
  currentlyEstimatedContainers: number // from final qty
}

export type PlanFarmerDeliveriesPayload = {
  pickUpDate: string // "YYYY-MM-DD"
  shift: ShiftName
}

// 🔹 NEW: return shape of plan endpoint
export type PlanFarmerDeliveriesResponse = {
  created: boolean
  deliveries: FarmerDeliveryDTO[]
  containerEstimatesPerOrder: ContainerEstimatePerOrderDTO[]
  estemated: number                // totalEstimatedContainers
  currentlyEstemated: number       // totalCurrentlyEstimatedContainers
}

/* -------------------------------------------------------------------------- */
/*                                Constants                                   */
/* -------------------------------------------------------------------------- */

const BASE = "/farmer-delivery"

/* -------------------------------------------------------------------------- */
/*                            API: Dashboard summary                           */
/* -------------------------------------------------------------------------- */

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

  return res.data?.data ?? []
}

/* -------------------------------------------------------------------------- */
/*                           API: Ensure / create plan                         */
/* -------------------------------------------------------------------------- */

export async function planFarmerDeliveriesForShift(params: {
  payload: PlanFarmerDeliveriesPayload
  signal?: AbortSignal
}): Promise<PlanFarmerDeliveriesResponse> {
  const { payload, signal } = params

  const res = await api.post(`${BASE}/plan`, payload, { signal })

  const data = res.data ?? {}

  return {
    created: Boolean(data.created),
    deliveries: (data.data ?? []) as FarmerDeliveryDTO[],
    containerEstimatesPerOrder:
      (data.containerEstimatesPerOrder ?? []) as ContainerEstimatePerOrderDTO[],
    estemated: Number(data.estemated ?? 0),
    currentlyEstemated: Number(data.currentlyEstemated ?? 0),
  }
}

/* -------------------------------------------------------------------------- */
/*                       API: Get deliveries for one shift                     */
/* -------------------------------------------------------------------------- */

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

  return res.data?.data ?? []
}
