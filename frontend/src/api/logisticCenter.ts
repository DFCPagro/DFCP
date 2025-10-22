import type { ShelfDTO } from "@/types/logisticCenter"

// Static mock shelves to simulate backend shape.
// Coordinates: grouped by zone (A, B, C) with row/col positions.
export const mockShelves: ShelfDTO[] = [
  // Zone A (rows: 3, cols: 6)
  ...Array.from({ length: 3 }).flatMap((_, r) =>
    Array.from({ length: 6 }).map((__, c) => {
      const row = r + 1
      const col = c + 1
      const idx = r * 6 + c + 1
      const occupied = idx % 3
      const maxSlots = 3
      const currentWeightKg = 120 * (idx % 5)
      const maxWeightKg = 600
      const busyScore = (idx * 11) % 100
      const liveActiveTasks = idx % 4
      return {
        _id: `A-${row}-${col}`,
        logisticCenterId: "demo",
        shelfId: `A-${row}-${col}`,
        type: "warehouse",
        zone: "A",
        aisle: String(Math.ceil(col / 3)),
        row,
        col,
        canvasX: null,
        canvasY: null,
        maxSlots,
        maxWeightKg,
        slots: Array.from({ length: maxSlots }).map((__, i) => ({
          slotId: String(i + 1),
          capacityKg: maxWeightKg / maxSlots,
          currentWeightKg: i < occupied ? (maxWeightKg / maxSlots) * 0.5 : 0,
          containerOpsId: i < occupied ? `ops-${idx}-${i + 1}` : null,
          occupiedAt: i < occupied ? new Date().toISOString() : null,
          emptiedAt: null,
          liveActiveTasks: i === 0 ? liveActiveTasks : 0,
          lastTaskPingAt: i === 0 ? new Date().toISOString() : null,
        })),
        currentWeightKg,
        occupiedSlots: occupied,
        liveActiveTasks,
        lastTaskPingAt: new Date().toISOString(),
        busyScore,
        isTemporarilyAvoid: busyScore > 85,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as ShelfDTO
    })
  ),

  // Zone B (rows: 4, cols: 3)
  ...Array.from({ length: 4 }).flatMap((_, r) =>
    Array.from({ length: 3 }).map((__, c) => {
      const row = r + 1
      const col = c + 1
      const idx = r * 3 + c + 1
      const occupied = (idx % 2) + 1
      const maxSlots = 3
      const currentWeightKg = 80 * idx
      const maxWeightKg = 400
      const busyScore = (idx * 17) % 100
      const liveActiveTasks = idx % 3
      return {
        _id: `B-${row}-${col}`,
        logisticCenterId: "demo",
        shelfId: `B-${row}-${col}`,
        type: row === 1 ? "picker" : "warehouse",
        zone: "B",
        aisle: String(col),
        row,
        col,
        canvasX: null,
        canvasY: null,
        maxSlots,
        maxWeightKg,
        slots: Array.from({ length: maxSlots }).map((__, i) => ({
          slotId: String(i + 1),
          capacityKg: maxWeightKg / maxSlots,
          currentWeightKg: i < occupied ? (maxWeightKg / maxSlots) * 0.4 : 0,
          containerOpsId: i < occupied ? `opsB-${idx}-${i + 1}` : null,
          occupiedAt: i < occupied ? new Date().toISOString() : null,
          emptiedAt: null,
          liveActiveTasks: i === 1 ? liveActiveTasks : 0,
          lastTaskPingAt: i === 1 ? new Date().toISOString() : null,
        })),
        currentWeightKg,
        occupiedSlots: occupied,
        liveActiveTasks,
        lastTaskPingAt: new Date().toISOString(),
        busyScore,
        isTemporarilyAvoid: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as ShelfDTO
    })
  ),

  // Zone C (3 blocks of 4x3 like your layout file)
  ...[0, 1, 2].flatMap((block) =>
    Array.from({ length: 4 }).flatMap((_, r) =>
      Array.from({ length: 3 }).map((__, c) => {
        const row = r + 1
        const col = c + 1 + block * 3
        const idx = block * 12 + r * 3 + c + 1
        const occupied = idx % 4
        const maxSlots = 3
        const currentWeightKg = 50 * (idx % 10)
        const maxWeightKg = 300
        const busyScore = (idx * 13) % 100
        const liveActiveTasks = idx % 5
        return {
          _id: `C-${row}-${col}`,
          logisticCenterId: "demo",
          shelfId: `C-${row}-${col}`,
          type: "delivery",
          zone: "C",
          aisle: String(col),
          row,
          col,
          canvasX: null,
          canvasY: null,
          maxSlots,
          maxWeightKg,
          slots: Array.from({ length: maxSlots }).map((__, i) => ({
            slotId: String(i + 1),
            capacityKg: maxWeightKg / maxSlots,
            currentWeightKg: i < occupied ? (maxWeightKg / maxSlots) * 0.3 : 0,
            containerOpsId: i < occupied ? `opsC-${idx}-${i + 1}` : null,
            occupiedAt: i < occupied ? new Date().toISOString() : null,
            emptiedAt: null,
            liveActiveTasks: i === 2 ? liveActiveTasks : 0,
            lastTaskPingAt: i === 2 ? new Date().toISOString() : null,
          })),
          currentWeightKg,
          occupiedSlots: occupied,
          liveActiveTasks,
          lastTaskPingAt: new Date().toISOString(),
          busyScore,
          isTemporarilyAvoid: busyScore > 90,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as ShelfDTO
      })
    )
  ),
]

// Simulated async fetch
export async function fetchMockShelves(): Promise<ShelfDTO[]> {
  await new Promise((r) => setTimeout(r, 300))
  return mockShelves
}
