export const getPrevMonth = (y: number, m: number) =>
  m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };

export const getNextMonth = (y: number, m: number) =>
  m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };

export const fmtTodayChip = (d: Date) =>
  d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); // "Aug 20"


export function formatDMY(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;

  if (isNaN(d.getTime())) return ""; // invalid date → empty string

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0"); // 0-based
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
}