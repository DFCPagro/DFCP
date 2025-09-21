export function fmtILS(n: number) {
return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 }).format(n || 0);
}


export function toMMSS(ms: number) {
const s = Math.max(0, Math.floor(ms / 1000));
const m = Math.floor(s / 60);
const sec = s % 60;
return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ---- append to format.ts ----

/** "120,000 g" (keep units in grams to match the legacy column) */
export function fmtGrams(n: number | null | undefined): string {
  const val = typeof n === "number" && isFinite(n) ? n : 0;
  return `${new Intl.NumberFormat("en-US").format(val)} g`;
}

/** "75%" or "—" when missing */
export function fmtPercent(n: number | null | undefined): string {
  if (typeof n !== "number" || !isFinite(n)) return "—";
  const clamped = Math.max(0, Math.min(100, Math.round(n)));
  return `${clamped}%`;
}

