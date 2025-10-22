export interface ShelfSlotDTO {
  slotId: string
  capacityKg: number
  currentWeightKg: number
  containerOpsId: string | null
  occupiedAt: string | null
  emptiedAt: string | null
  liveActiveTasks: number
  lastTaskPingAt: string | null
}

export interface ShelfDTO {
  _id: string
  logisticCenterId: string
  shelfId: string
  type: ShelfType
  zone: string | null
  aisle: string | null
  row: number | null
  col: number | null
  canvasX: number | null
  canvasY: number | null
  maxSlots: number
  maxWeightKg: number
  slots: ShelfSlotDTO[]
  currentWeightKg: number
  occupiedSlots: number
  liveActiveTasks: number
  lastTaskPingAt: string | null
  busyScore: number
  isTemporarilyAvoid: boolean
  createdAt: string
  updatedAt: string
}

export interface GridZoneLayout {
  zone: string
  rows: number
  cols: number
  position?: { x: number; y: number }
  showRowIndex?: boolean
  showColIndex?: boolean
  colLabels?: ColLabelMode
  titleSize?: number
  byCell: Record<string, ShelfDTO | null>
}

export interface LayoutZone {
  zone: string
  rows: number
  cols: number
  position: { x: number; y: number }
  showRowIndex?: boolean
  showColIndex?: boolean
  colLabels?: ColLabelMode
  titleSize?: number
  aisles?: number[]
  aisleRotate?: boolean
  aisleLeft?: number
}

export interface LayoutFile {
  zones: LayoutZone[]
}

// ==== Backend DTOs ====

export interface ShelfSlotDTO {
  slotId: string
  capacityKg: number
  currentWeightKg: number
  containerOpsId: string | null
  occupiedAt: string | null
  emptiedAt: string | null
  liveActiveTasks: number
  lastTaskPingAt: string | null
}

export interface ShelfDTO {
  _id: string
  logisticCenterId: string
  shelfId: string
  type: ShelfType
  zone: string | null
  aisle: string | null
  row: number | null
  col: number | null
  canvasX: number | null
  canvasY: number | null
  maxSlots: number
  maxWeightKg: number
  slots: ShelfSlotDTO[]
  currentWeightKg: number
  occupiedSlots: number
  liveActiveTasks: number
  lastTaskPingAt: string | null
  busyScore: number
  isTemporarilyAvoid: boolean
  createdAt: string
  updatedAt: string
}

// ==== Frontend shape for rendering ====


export interface GridZoneLayout {
  zone: string
  rows: number
  cols: number
  // optional absolute position (fallback when canvas coords exist)
  position?: { x: number; y: number }
  showRowIndex?: boolean
  showColIndex?: boolean
  colLabels?: ColLabelMode
  titleSize?: number
  // map "r-c" => shelf
  byCell: Record<string, ShelfDTO | null>
}



//////////////////////
export interface ShelfSlotDTO {
  slotId: string
  capacityKg: number
  currentWeightKg: number
  containerOpsId: string | null
  occupiedAt: string | null
  emptiedAt: string | null
  liveActiveTasks: number
  lastTaskPingAt: string | null
}

export interface ShelfDTO {
  _id: string
  logisticCenterId: string
  shelfId: string
  type: ShelfType
  zone: string | null
  aisle: string | null
  row: number | null
  col: number | null
  canvasX: number | null
  canvasY: number | null
  maxSlots: number
  maxWeightKg: number
  slots: ShelfSlotDTO[]
  currentWeightKg: number
  occupiedSlots: number
  liveActiveTasks: number
  lastTaskPingAt: string | null
  busyScore: number
  isTemporarilyAvoid: boolean
  createdAt: string
  updatedAt: string
}

export interface GridZoneLayout {
  zone: string
  rows: number
  cols: number
  position?: { x: number; y: number }
  showRowIndex?: boolean
  showColIndex?: boolean
  colLabels?: ColLabelMode
  titleSize?: number
  byCell: Record<string, ShelfDTO | null>
}

/** ===== World / Real-map types (absolute coordinates in meters) ===== */
export interface WorldGridSpec {
  rows: number
  cols: number
  showRowIndex?: boolean
  showColIndex?: boolean
  colLabels?: ColLabelMode
  titleSize?: number
}

export interface WorldZone {
  id: string // "A" | "B" | ...
  x: number // meters from world origin (left)
  y: number // meters from world origin (top)
  width: number // meters
  height: number // meters
  grid: WorldGridSpec
}

export interface WorldSpec {
  pixelsPerMeter: number
  zones: WorldZone[]
}




////////////////////////


export type ShelfType = "warehouse" | "picker" | "delivery"

export interface ShelfSlotDTO {
  slotId: string
  capacityKg: number
  currentWeightKg: number
  containerOpsId: string | null
  occupiedAt: string | null
  emptiedAt: string | null
  liveActiveTasks: number
  lastTaskPingAt: string | null
}

export interface ShelfDTO {
  _id: string
  logisticCenterId: string
  shelfId: string
  type: ShelfType
  zone: string | null
  aisle: string | null
  row: number | null
  col: number | null
  canvasX: number | null
  canvasY: number | null
  maxSlots: number
  maxWeightKg: number
  slots: ShelfSlotDTO[]
  currentWeightKg: number
  occupiedSlots: number
  liveActiveTasks: number
  lastTaskPingAt: string | null
  busyScore: number
  isTemporarilyAvoid: boolean
  createdAt: string
  updatedAt: string
}

export type ColLabelMode = "letters" | "numbers"

export interface GridZoneLayout {
  zone: string
  rows: number
  cols: number
  position?: { x: number; y: number }
  showRowIndex?: boolean
  showColIndex?: boolean
  colLabels?: ColLabelMode
  titleSize?: number
  byCell: Record<string, ShelfDTO | null>
}

/** ===== World / Real-map types (absolute coordinates in meters) ===== */
export interface WorldGridSpec {
  rows: number
  cols: number
  showRowIndex?: boolean
  showColIndex?: boolean
  colLabels?: ColLabelMode
  titleSize?: number
}

export interface WorldZone {
  id: string // "A" | "B" | ...
  x: number // meters from world origin (left)
  y: number // meters from world origin (top)
  width: number // meters
  height: number // meters
  grid: WorldGridSpec
}

export interface WorldSpec {
  pixelsPerMeter: number
  zones: WorldZone[]
}
