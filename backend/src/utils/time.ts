// utils/time.ts
export const hhmmToMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h * 60 + m) | 0;
};

export const minToHhmm = (min: number): string => {
  const mm = Math.max(0, Math.min(1439, Math.floor(min)));
  const h = Math.floor(mm / 60).toString().padStart(2, "0");
  const m = (mm % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};

export const normalizeWindow = (startMin: number, endMin: number) => ({
  startMin,
  endMin,
  start: minToHhmm(startMin),
  end: minToHhmm(endMin),
});
