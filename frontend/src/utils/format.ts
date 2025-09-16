export function fmtILS(n: number) {
return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 }).format(n || 0);
}


export function toMMSS(ms: number) {
const s = Math.max(0, Math.floor(ms / 1000));
const m = Math.floor(s / 60);
const sec = s % 60;
return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}