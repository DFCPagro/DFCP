import type { ShelfDTO } from "@/types/logisticCenter"
import { worldLayout } from "./worldLayout"

// Build static shelves that match the world grid sizes.
// Keys: `${zone}-${row}-${col}`
function shelf(zone: string, row: number, col: number, patch?: Partial<ShelfDTO>): ShelfDTO {
  const id = `${zone}-${row}-${col}`
  const maxSlots = 3
  const maxWeightKg = 600
  const occupied = (row * 7 + col) % 3 // 0..2
  const busy = (row * 17 + col * 11) % 100
  const live = (row + col) % 5

  const base: ShelfDTO = {
    _id: id,
    logisticCenterId: "demo",
    shelfId: id,
    type: "warehouse",
    zone,
    aisle: String(col),
    row,
    col,
    canvasX: null,
    canvasY: null,
    maxSlots,
    maxWeightKg,
    slots: Array.from({ length: maxSlots }).map((_, i) => ({
      slotId: String(i + 1),
      capacityKg: maxWeightKg / maxSlots,
      currentWeightKg: i < occupied ? (maxWeightKg / maxSlots) * 0.55 : 0,
      containerOpsId: i < occupied ? `ops-${id}-${i + 1}` : null,
      occupiedAt: i < occupied ? new Date().toISOString() : null,
      emptiedAt: null,
      liveActiveTasks: i === 1 ? live : 0,
      lastTaskPingAt: i === 1 ? new Date().toISOString() : null,
    })),
    currentWeightKg: (maxWeightKg / 3) * occupied * 0.55,
    occupiedSlots: occupied,
    liveActiveTasks: live,
    lastTaskPingAt: new Date().toISOString(),
    busyScore: busy,
    isTemporarilyAvoid: busy > 85,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  return { ...base, ...patch }
}

// Construct shelvesByZone map matching worldLayout.grids
export const shelvesByZone: Record<string, Record<string, ShelfDTO>> = (() => {
  const map: Record<string, Record<string, ShelfDTO>> = {}
  for (const z of worldLayout.zones) {
    const zoneMap: Record<string, ShelfDTO> = {}
    for (let r = 1; r <= z.grid.rows; r++) {
      for (let c = 1; c <= z.grid.cols; c++) {
        zoneMap[`${r}-${c}`] = shelf(z.id, r, c)
      }
    }
    map[z.id] = zoneMap
  }

  // EXPLICIT "CROWDED" EXAMPLE: Zone C, row 3, col 6
  map["C"]["3-6"] = shelf("C", 3, 6, {
    busyScore: 92,
    liveActiveTasks: 7,
    occupiedSlots: 3,
    currentWeightKg: 560,
    isTemporarilyAvoid: true,
    type: "picker",
    slots: [
      {
        slotId: "1",
        capacityKg: 200,
        currentWeightKg: 180,
        containerOpsId: "OPS-CROWDED-1",
        occupiedAt: new Date().toISOString(),
        emptiedAt: null,
        liveActiveTasks: 3,
        lastTaskPingAt: new Date().toISOString(),
      },
      {
        slotId: "2",
        capacityKg: 200,
        currentWeightKg: 190,
        containerOpsId: "OPS-CROWDED-2",
        occupiedAt: new Date().toISOString(),
        emptiedAt: null,
        liveActiveTasks: 2,
        lastTaskPingAt: new Date().toISOString(),
      },
      {
        slotId: "3",
        capacityKg: 200,
        currentWeightKg: 190,
        containerOpsId: "OPS-CROWDED-3",
        occupiedAt: new Date().toISOString(),
        emptiedAt: null,
        liveActiveTasks: 2,
        lastTaskPingAt: new Date().toISOString(),
      },
    ],
  })

  return map
})()

// Convenience helper for WorldMap
export function shelvesByZoneToCells(): Record<string, Record<string, ShelfDTO | null>> {
  const out: Record<string, Record<string, ShelfDTO | null>> = {}
  for (const [zone, cells] of Object.entries(shelvesByZone)) {
    const inner: Record<string, ShelfDTO | null> = {}
    for (const [key, value] of Object.entries(cells)) inner[key] = value
    out[zone] = inner
  }
  return out
}
