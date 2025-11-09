// Quality Standards (per backend schema)
export type MetricKey =
  | "brix"
  | "acidityPercentage"
  | "pressure"
  | "colorDescription"
  | "colorPercentage"
  | "weightPerUnitG"
  | "diameterMM"
  | "qualityGrade"
  | "maxDefectRatioLengthDiameter"
  | "rejectionRate"

export type MetricDef = {
  key: MetricKey
  label: string
  type: "number" | "text"
  unit?: string
  seedA?: number
}

// Single source of truth for tolerance
export const TOLERANCE_PCT = 2 as const

export const METRICS: MetricDef[] = [
  { key: "brix", label: "Sugar (Brix)", type: "number", unit: "°Bx", seedA: 12 },
  { key: "acidityPercentage", label: "Acidity", type: "number", unit: "%", seedA: 0.5 },
  { key: "pressure", label: "Pressure", type: "number", unit: "N", seedA: 20 },
  { key: "colorDescription", label: "Color (description)", type: "text" },
  { key: "colorPercentage", label: "Color (percentage)", type: "number", unit: "%", seedA: 90 },
  { key: "weightPerUnitG", label: "Weight per unit", type: "number", unit: "g", seedA: 150 },
  { key: "diameterMM", label: "Diameter", type: "number", unit: "mm", seedA: 60 },
  { key: "qualityGrade", label: "Quality grade (text)", type: "text" },
  {
    key: "maxDefectRatioLengthDiameter",
    label: "Max defect ratio (L/D)",
    type: "number",
    unit: "",
    seedA: 0.1,
  },
  { key: "rejectionRate", label: "Rejection rate", type: "number", unit: "%", seedA: 2 },
]
