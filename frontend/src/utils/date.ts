export const getPrevMonth = (y: number, m: number) =>
  m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };

export const getNextMonth = (y: number, m: number) =>
  m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };

export const fmtTodayChip = (d: Date) =>
  d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); // "Aug 20"
