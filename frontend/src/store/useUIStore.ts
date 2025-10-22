import { create } from "zustand"
import type { ShelfDTO } from "@/types/logisticCenter"

type ScanMode = "container" | "slot"

interface UIState {
  // filters
  filterType: "all" | "warehouse" | "picker" | "delivery"
  onlyAvoid: boolean
  crowdedOnly: boolean

  setFilterType: (t: UIState["filterType"]) => void
  setOnlyAvoid: (v: boolean) => void
  setCrowdedOnly: (v: boolean) => void

  // dialogs
  scanOpen: boolean
  scanMode: ScanMode
  openScan: (mode: ScanMode) => void
  closeScan: () => void

  detailOpen: boolean
  detailShelf: ShelfDTO | null
  openDetail: (s: ShelfDTO) => void
  closeDetail: () => void
}

export const useUIStore = create<UIState>((set) => ({
  filterType: "all",
  onlyAvoid: false,
  crowdedOnly: false,

  setFilterType: (t) => set({ filterType: t }),
  setOnlyAvoid: (v) => set({ onlyAvoid: v }),
  setCrowdedOnly: (v) => set({ crowdedOnly: v }),

  scanOpen: false,
  scanMode: "container",
  openScan: (mode) => set({ scanOpen: true, scanMode: mode }),
  closeScan: () => set({ scanOpen: false }),

  detailOpen: false,
  detailShelf: null,
  openDetail: (s) => set({ detailOpen: true, detailShelf: s }),
  closeDetail: () => set({ detailOpen: false, detailShelf: null }),
}))
