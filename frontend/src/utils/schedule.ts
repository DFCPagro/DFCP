export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function asWeeklySchedule(mask?: number[]): number[] | undefined {
  if (!mask) return undefined;
  const seven = mask
    .slice(0, 7)
    .map((v) => Math.max(0, Number.isFinite(v) ? Math.trunc(v) : 0));
  while (seven.length < 7) seven.push(0);
  return seven;
}

export function normalizeWeekly(mask?: number[]): number[] {
  const base = Array(7).fill(0);
  if (!Array.isArray(mask)) return base;
  return base.map((_, i) => {
    const v = mask[i] ?? 0;
    const n = (v as number) | 0;
    return Math.max(0, Math.min(15, n)); // Morning=1, Afternoon=2, Evening=4, Night=8
  });
}
