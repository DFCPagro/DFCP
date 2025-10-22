import type { ShelfDTO } from "@/types/logisticCenter"

export type ShelvesByZone = Record<string, Record<string, ShelfDTO | null>>

export function filterShelvesByUI(
  shelves: ShelvesByZone,
  opts: {
    filterType: "all" | "warehouse" | "picker" | "delivery"
    onlyAvoid: boolean
    crowdedOnly: boolean // busy >= 70
  },
): ShelvesByZone {
  const out: ShelvesByZone = {}
  for (const [zone, cells] of Object.entries(shelves)) {
    const inner: Record<string, ShelfDTO | null> = {}
    for (const [key, shelf] of Object.entries(cells)) {
      if (!shelf) {
        inner[key] = shelf
        continue
      }
      if (opts.filterType !== "all" && shelf.type !== opts.filterType) continue
      if (opts.onlyAvoid && !shelf.isTemporarilyAvoid) continue
      if (opts.crowdedOnly && (shelf.busyScore ?? 0) < 70) continue
      inner[key] = shelf
    }
    out[zone] = inner
  }
  return out
}
