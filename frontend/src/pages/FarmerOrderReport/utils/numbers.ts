export function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function safeNumber(v: string | number): number {
  const n = typeof v === "string" && v.trim() === "" ? NaN : Number(v)
  if (!Number.isFinite(n)) return 0
  return n
}

export function formatNum(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "0"
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)
}
