export const fmt = (iso: string) => new Date(iso).toLocaleString();
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();
export const minutesUntil = (iso: string) =>
  Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
export const twoHoursBefore = (iso: string) =>
  new Date(new Date(iso).getTime() - 2 * 3600_000).toISOString();
