// src/api/customerDelivery.ts

// Reuse the same shift type you use elsewhere
export type ShiftName = "morning" | "afternoon" | "evening" | "night"

export type CustomerDeliveryStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "problem"

export type CustomerDeliveryDTO = {
  id: string
  shift: ShiftName
  customerName: string
  address: string
  orderCount: number
  driverId?: string | null
  driverName?: string | null
  status: CustomerDeliveryStatus
  eta?: string // ISO string if you want
}

export type CustomerDeliveryShiftSummary = {
  shift: ShiftName
  shiftLabel: string
  windowLabel?: string
  total: number
  pending: number
  in_progress: number
  done: number
  problem: number
  statusLabel: string
}

// -----------------------------------------------------------------------------
// Fake data (in-memory for now)
// -----------------------------------------------------------------------------

const MOCK_CUSTOMER_DELIVERIES: CustomerDeliveryDTO[] = [
  {
    id: "cd-m-1",
    shift: "morning",
    customerName: "Dana Levi",
    address: "Herzl 10, Tel Aviv",
    orderCount: 2,
    driverId: "drv-1",
    driverName: "Yossi Cohen",
    status: "in_progress",
    eta: new Date().toISOString(),
  },
  {
    id: "cd-m-2",
    shift: "morning",
    customerName: "Amit Bar",
    address: "Dizengoff 200, Tel Aviv",
    orderCount: 1,
    driverId: "drv-1",
    driverName: "Yossi Cohen",
    status: "pending",
  },
  {
    id: "cd-a-1",
    shift: "afternoon",
    customerName: "Noa Shalev",
    address: "Rothschild 50, Tel Aviv",
    orderCount: 3,
    driverId: "drv-2",
    driverName: "Maya Azulay",
    status: "pending",
  },
  {
    id: "cd-a-2",
    shift: "afternoon",
    customerName: "Omri N.",
    address: "Ben Gurion 12, Ramat Gan",
    orderCount: 1,
    driverId: "drv-2",
    driverName: "Maya Azulay",
    status: "in_progress",
  },
  {
    id: "cd-e-1",
    shift: "evening",
    customerName: "Shirin I.",
    address: "Some Street 5, Holon",
    orderCount: 4,
    driverId: "drv-3",
    driverName: "Tal Levi",
    status: "done",
  },
  {
    id: "cd-e-2",
    shift: "evening",
    customerName: "Test Problem Customer",
    address: "Debug Ave 404, Tel Aviv",
    orderCount: 1,
    driverId: "drv-3",
    driverName: "Tal Levi",
    status: "problem",
  },
  {
    id: "cd-n-1",
    shift: "night",
    customerName: "Late Order User",
    address: "Night St 1, Bat Yam",
    orderCount: 1,
    driverId: null,
    driverName: null,
    status: "pending",
  },
]

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatShiftLabel(shift: ShiftName): string {
  switch (shift) {
    case "morning":
      return "Morning"
    case "afternoon":
      return "Afternoon"
    case "evening":
      return "Evening"
    case "night":
      return "Night"
    default:
      return shift
  }
}

function computeStatusLabel(summary: CustomerDeliveryShiftSummary): string {
  if (summary.problem > 0) return "Issues detected"
  if (summary.in_progress > 0) return "In progress"
  if (summary.total === 0) return "No deliveries"
  if (summary.done === summary.total) return "All completed"
  return "Scheduled"
}

// -----------------------------------------------------------------------------
// Public API – using fake data for now
// -----------------------------------------------------------------------------

/**
 * Dashboard summary by shift for customer deliveries.
 * Currently computed from in-memory mock data.
 */
export async function getCustomerDeliveriesSummary(): Promise<
  CustomerDeliveryShiftSummary[]
> {
  const shifts: ShiftName[] = ["morning", "afternoon", "evening", "night"]

  const summaries: CustomerDeliveryShiftSummary[] = shifts.map((shift) => {
    const rows = MOCK_CUSTOMER_DELIVERIES.filter(
      (d) => d.shift === shift,
    )

    const total = rows.length
    const pending = rows.filter((r) => r.status === "pending").length
    const in_progress = rows.filter((r) => r.status === "in_progress").length
    const done = rows.filter((r) => r.status === "done").length
    const problem = rows.filter((r) => r.status === "problem").length

    const summary: CustomerDeliveryShiftSummary = {
      shift,
      shiftLabel: formatShiftLabel(shift),
      windowLabel: undefined, // fill later if you connect to real shift windows
      total,
      pending,
      in_progress,
      done,
      problem,
      statusLabel: "", // filled below
    }

    summary.statusLabel = computeStatusLabel(summary)
    return summary
  })

  // mimic async API
  return Promise.resolve(summaries)
}

/**
 * Detailed list of deliveries for a given shift.
 * Currently returns filtered mock data.
 */
export async function getCustomerDeliveriesByShift(
  shift: ShiftName,
): Promise<CustomerDeliveryDTO[]> {
  const rows = MOCK_CUSTOMER_DELIVERIES.filter(
    (d) => d.shift === shift,
  )
  return Promise.resolve(rows)
}
