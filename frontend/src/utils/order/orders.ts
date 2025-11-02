import type { OrderRowAPI } from "@/types/orders";

export type UIStatus =
  | "pending" | "accepted" | "farmer" | "farm_to_lc" | "logistic_center"
  | "packed" | "ready_for_delivery" | "lc_to_customer" | "delivered" | "confirm_receiving";

export type DateFilter = "ALL" | "WEEK" | "MONTH" | "CUSTOM";
export type LatLng = { lat: number; lng: number };

export const STATUS_LABEL: Record<UIStatus, string> = {
  pending: "pending",
  accepted: "accepted",
  farmer: "farmer",
  farm_to_lc: "from farmer to logistic center",
  logistic_center: "logistic center",
  packed: "packed",
  ready_for_delivery: "ready for delivery",
  lc_to_customer: "delivering",
  delivered: "delivered",
  confirm_receiving: "confirm receiving",
};

export const STATUS_EMOJI: Record<UIStatus, string> = {
  pending: "⏳",
  accepted: "👍",
  farmer: "👨‍🌾",
  farm_to_lc: "🚚",
  logistic_center: "🏬",
  packed: "📦",
  ready_for_delivery: "✅",
  lc_to_customer: "🛵",
  delivered: "🏠",
  confirm_receiving: "🧾",
};

export const STATUS_OPTIONS: Array<"ALL" | UIStatus> = [
  "ALL","pending","accepted","farmer","farm_to_lc","logistic_center",
  "packed","ready_for_delivery","lc_to_customer","delivered","confirm_receiving",
];

export function normalizeStatus(s: string): UIStatus {
  const key = s.toLowerCase().replaceAll(/\s+/g, "_");
  switch (key) {
    case "created": return "pending";
    case "out_for_delivery": return "lc_to_customer";
    case "confirmed": return "confirm_receiving";
    case "accepted": return "accepted";
    case "farmer": return "farmer";
    case "form_framer_to_the_logistic_center":
    case "from_farmer_to_the_logistic_center":
    case "farm_to_lc": return "farm_to_lc";
    case "logistic_center": return "logistic_center";
    case "packed": return "packed";
    case "ready_for_delivery": return "ready_for_delivery";
    case "from_the_logistic_to_the_costmer":
    case "from_the_logistic_to_the_customer":
    case "lc_to_customer":
    case "delivering": return "lc_to_customer";
    case "delivered": return "delivered";
    case "confirm_reciveing":
    case "confirm_receiving": return "confirm_receiving";
    default: return "pending";
  }
}

// date + delivery-time helpers
function p2(n: number) { return String(n).padStart(2, "0"); }
function fmtHM(d: Date) { return `${p2(d.getHours())}:${p2(d.getMinutes())}`; }
function asDate(v?: string | number | Date) {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.valueOf()) ? undefined : d;
}
function takeHM(v?: string) {
  if (!v) return undefined;
  if (v.includes("T")) { const d = asDate(v); return d ? fmtHM(d) : undefined; }
  const m = v.match(/(\d{1,2}):(\d{2})/);
  return m ? `${p2(+m[1])}:${m[2]}` : undefined;
}
function fmtDateYY(d: Date) { return `${p2(d.getDate())}/${p2(d.getMonth()+1)}/${String(d.getFullYear()).slice(-2)}`; }

export function formatDeliveryTime(o: any) {
  const d = asDate(o.acceptedAt) ?? asDate(o.deliveryDate) ?? asDate(o.scheduledAt) ?? asDate(o.createdAt) ?? new Date();
  const s = takeHM(o.acceptedWindowStart) ?? takeHM(o.deliveryWindowStart) ?? takeHM(o.windowStart);
  const e = takeHM(o.acceptedWindowEnd)   ?? takeHM(o.deliveryWindowEnd)   ?? takeHM(o.windowEnd);
  let range = s && e ? `${s}–${e}` : "";
  if (!range) {
    const m = String(o.acceptedSlotLabel ?? o.deliverySlot ?? "").match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
    if (m) {
      const [h1,m1] = m[1].split(":"); const [h2,m2] = m[2].split(":");
      range = `${p2(+h1)}:${m1}–${p2(+h2)}:${m2}`;
    }
  }
  if (!range) range = "00:00–00:00";
  return `${fmtDateYY(d)} ${range}`;
}

export function fmtDateShort(iso: string) {
  const d = new Date(iso); if (Number.isNaN(d.valueOf())) return iso;
  return `${p2(d.getDate())}/${p2(d.getMonth()+1)}/${String(d.getFullYear()).slice(-2)}`;
}

export function startOfWeek(d: Date) {
  const day = d.getDay(); const diff = (day + 6) % 7;
  const s = new Date(d); s.setHours(0,0,0,0); s.setDate(s.getDate()-diff); return s;
}
export function startOfMonth(d: Date) { const s = new Date(d.getFullYear(), d.getMonth(), 1); s.setHours(0,0,0,0); return s; }
export function toEndOfDay(d: Date) { const e = new Date(d); e.setHours(23,59,59,999); return e; }

export function isReported(o: any) { return Boolean(o?.reported || o?.isReported || o?.reportFlag || o?.issue); }

export function getDeliveryCoord(o: any): LatLng | null {
  const to = o.delivery ?? o.shippingAddress ?? o.customer?.location ?? (o.destLat && o.destLng ? { lat: o.destLat, lng: o.destLng } : null);
  return to && to.lat && to.lng ? to : null;
}

export function partitionOrders(orders: OrderRowAPI[]) {
  const active: OrderRowAPI[] = [];
  const old: OrderRowAPI[] = [];
  const reported: OrderRowAPI[] = [];
  for (const o of orders ?? []) {
    if (isReported(o)) { reported.push(o); continue; }
    const ui = normalizeStatus((o as any).stageKey);
    if (ui === "delivered" || ui === "confirm_receiving") old.push(o);
    else active.push(o);
  }
  return { active, old, reported };
}
