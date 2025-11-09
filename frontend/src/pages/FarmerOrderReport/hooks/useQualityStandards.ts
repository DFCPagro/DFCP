import * as React from "react"
import { METRICS, TOLERANCE_PCT, type MetricKey } from "../constants/metrics"
import { formatNum, safeNumber } from "../utils/numbers"

type ABC = { A: string; B: string; C: string; unit?: string }

export function useQualityStandards() {
  // QS state
  const [qsABC, setQsABC] = React.useState<Record<MetricKey, ABC>>(() => {
    const seed: Record<MetricKey, ABC> = {} as any
    METRICS.forEach((m) => {
      seed[m.key] = {
        A: m.type === "number" && Number.isFinite(m.seedA) ? String(m.seedA) : "",
        B: "",
        C: "",
        unit: m.unit,
      }
    })
    return seed
  })

  const [qsMeasured, setQsMeasured] = React.useState<Record<MetricKey, number | string>>(() => {
    const seed: Record<MetricKey, number | string> = {} as any
    METRICS.forEach((m) => {
      seed[m.key] = m.type === "number" && Number.isFinite(m.seedA) ? Number(m.seedA) : ""
    })
    return seed
  })

  // helpers
  function parseA(key: MetricKey): number | null {
    const a = Number(qsABC[key]?.A)
    return Number.isFinite(a) ? a : null
  }

  function deviationInfo(key: MetricKey, val: number) {
    const A = parseA(key) ?? 0
    const lower = A * (1 - TOLERANCE_PCT / 100)
    const upper = A * (1 + TOLERANCE_PCT / 100)
    const out = Number(val) < lower || Number(val) > upper
    const deviationPct = Math.min(100, Math.abs(((Number(val) - A) / (A || 1)) * 100))
    return { out, lower: Number(formatNum(lower)), upper: Number(formatNum(upper)), deviationPct, A: Number(formatNum(A)) }
  }

  const qualityWarnings = React.useMemo(() => {
    const warns: string[] = []
    METRICS.filter((m) => m.type === "number").forEach((m) => {
      const v = Number(qsMeasured[m.key])
      const A = parseA(m.key)
      if (!Number.isFinite(v) || A == null || !Number.isFinite(A)) return
      const { out } = deviationInfo(m.key, v)
      if (out) {
        warns.push(
          `${m.label}: ${formatNum(v)}${m.unit ?? ""} deviates from A=${formatNum(A)}${m.unit ?? ""} by >${TOLERANCE_PCT}%`,
        )
      }
    })
    return warns
  }, [qsMeasured, qsABC])

  const qualityDeviationCount = qualityWarnings.length

  return {
    qsABC, setQsABC,
    qsMeasured, setQsMeasured,
    parseA, deviationInfo, safeNumber,
    qualityWarnings, qualityDeviationCount,
  }
}
