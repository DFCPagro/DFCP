// utils/orders.ts

import type { OrderRowAPI } from "@/types/orders";
import type { ItemRow } from "@/components/common/ItemList";

export type UIStatus =
  | "pending"
  | "confirmed"
  | "farmer"
  | "intransit"
  | "packing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "received"
  | "cancelled";

export type LatLng = { lat: number; lng: number };

export const LOGISTIC_CENTER: LatLng = { lat: 32.733459, lng: 35.218805 };

export const STATUS_LABEL: Record<UIStatus, string> = {
  pending: "pending",
  confirmed: "confirmed",
  farmer: "farmer",
  intransit: "in transit",
  packing: "packing",
  ready_for_pickup: "ready for pickup",
  out_for_delivery: "out for delivery",
  delivered: "delivered",
  received: "received",
  cancelled: "cancelled",
};

export const STATUS_EMOJI: Record<UIStatus, string> = {
  pending: "⏳",
  confirmed: "👍",
  farmer: "👨‍🌾",
  intransit: "🚚",
  packing: "🏬",
  ready_for_pickup: "📦",
  out_for_delivery: "🛵",
  delivered: "🏠",
  received: "🧾",
  cancelled: "❌",
};

export function normalizeStatus(s: string): UIStatus {
  const key = (s ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  switch (key) {
    case "created":
    case "new":
    case "pending":
      return "pending";
    case "accepted":
    case "confirmed":
      return "confirmed";
    case "farmer":
    case "at_farmer":
      return "farmer";
    case "in_transit":
    case "intransit":
    case "form_framer_to_the_logistic_center":
    case "from_farmer_to_the_logistic_center":
    case "farm_to_lc":
      return "intransit";
    case "packing":
    case "processing":
    case "logistic_center":
    case "at_logistic_center":
      return "packing";
    case "packed":
    case "ready_for_delivery":
    case "ready_for_pickup":
      return "ready_for_pickup";
    case "delivering":
    case "lc_to_customer":
    case "from_the_logistic_to_the_costmer":
    case "from_the_logistic_to_the_customer":
    case "out_for_delivery":
      return "out_for_delivery";
    case "delivered":
      return "delivered";
    case "confirm_reciveing":
    case "confirm_receiving":
    case "received":
    case "recived":
      return "received";
    case "canceled":
    case "cancelled":
    case "problem":
      return "cancelled";
    default:
      return "pending";
  }
}

export function isOldStatus(s: any) {
  const ui = normalizeStatus(String(s));
  return ui === "delivered" || ui === "received" || ui === "cancelled";
}

// ---- date helpers ----
function fmt2(n: number) {
  return String(n).padStart(2, "0");
}
export function fmtDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  const dd = fmt2(d.getDate());
  const mm = fmt2(d.getMonth() + 1);
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}
export function fmtDateYY(d: Date) {
  return `${fmt2(d.getDate())}/${fmt2(d.getMonth() + 1)}/${String(
    d.getFullYear()
  ).slice(-2)}`;
}
export function toEndOfDay(d: Date) {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}
export function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - diff);
  return s;
}
export function startOfMonth(d: Date) {
  const s = new Date(d.getFullYear(), d.getMonth(), 1);
  s.setHours(0, 0, 0, 0);
  return s;
}
function fmtHM(d: Date) {
  return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
}
function toDate(v?: string | number | Date) {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.valueOf()) ? undefined : d;
}
function normHM(v?: string) {
  if (!v) return undefined;
  if (v.includes("T")) {
    const d = toDate(v);
    return d ? fmtHM(d) : undefined;
  }
  const m = v.match(/(\d{1,2}):(\d{2})/);
  return m ? `${fmt2(+m[1])}:${m[2]}` : undefined;
}

/**
 * Return date and shift separately so the UI can style the shift differently.
 * - Date is normalized to midnight.
 * - Shift is picked from common fields, fallback "".
 */
export function formatDeliveryTimeParts(o: any) {
  const d = new Date((toDate(o.deliveryDate) ?? new Date()).setHours(0, 0, 0, 0));
  const date = fmtDateYY(d);
  const shift = firstStr(o.shiftName, o.shift, o.deliveryShiftName) ?? "";
  return { date, shift };
}

/**
 * Optional: return an HTML string with a class on the shift.
 * Use if rendering dangerously or in environments expecting HTML.
 */
export function formatDeliveryTimeHTML(o: any, cls = "shiftName") {
  const { date, shift } = formatDeliveryTimeParts(o);
  return shift ? `${date} <span class="${cls}">${shift}</span>` : date;
}

/**
 * Legacy formatter kept for callers expecting a single string.
 * Uses parts and concatenates with a space.
 */
export function formatDeliveryTime(o: any) {
  const { date, shift } = formatDeliveryTimeParts(o);
  return shift ? `${date} ${shift}` : date;
}

// ---- Item rows for ItemList ----
export function toItemRows(lines: any[]): ItemRow[] {
  return (lines ?? []).map((line: any, i: number) => {
    const title =
      firstStr(
        line?.name,
        line?.displayName,
        line?.item?.name,
        line?.item?.displayName
      ) ?? "Item";

    const imageUrl =
      firstStr(line?.imageUrl, line?.item?.imageUrl, line?.photoUrl) ?? undefined;

    const category = firstStr(line?.category, line?.item?.category) ?? "";

    const farmerName = firstStr(
      line?.sourceFarmerName,
      line?.farmerName,
      line?.farmer?.name
    );
    const farmName = firstStr(
      line?.sourceFarmName,
      line?.farmName,
      line?.farmer?.farmName
    );
    const farmLogo =
      firstStr(line?.sourceFarmLogo, line?.farmLogo, line?.farmer?.logo) ?? undefined;

    const pricePerUnit = toNum(line?.pricePerUnit);
    const unitMode =
      (line?.unitMode as "kg" | "unit" | "mixed") ?? ("kg" as const);
    const qtyKg = toNumUndef(line?.quantityKg);
    const qtyUnits = toIntUndef(line?.units);

    const avgWeightPerUnitKg = toNumUndef(
      line?.estimatesSnapshot?.avgWeightPerUnitKg ??
        line?.estimates?.avgWeightPerUnitKg
    );

    const availableUnitsEstimate =
      toIntUndef(line?.availableUnitsEstimate) ??
      (avgWeightPerUnitKg && qtyKg
        ? Math.round(qtyKg / avgWeightPerUnitKg)
        : undefined);

    const subtitle =
      farmerName || farmName
        ? [farmerName, farmName].filter(Boolean).join("•")
        : undefined;

    return {
      id: line?._id ?? line?.id ?? String(i),
      title,
      subtitle,
      imageUrl,
      category,
      farmLogo,
      farmName,
      pricePerUnit,
      unitMode,
      qtyKg,
      qtyUnits,
      avgWeightPerUnitKg,
      availableUnitsEstimate,
    } as ItemRow;
  });
}

export function pickCurrency(items: any[]): string | undefined {
  for (const it of items ?? []) if (it?.currency) return it.currency;
  return undefined;
}

// ---- coords helpers ----
function asNum(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : undefined;
}
function arrToLatLng(a: any): LatLng | null {
  if (!Array.isArray(a) || a.length < 2) return null;
  const a0 = Number(a[0]), a1 = Number(a[1]);
  if (!Number.isFinite(a0) || !Number.isFinite(a1)) return null;
  const looksLatLng = Math.abs(a0) <= 90 && Math.abs(a1) <= 180;
  const lat = looksLatLng ? a0 : a1;
  const lng = looksLatLng ? a1 : a0;
  return { lat, lng };
}
function pick(obj: any, ...paths: string[]) {
  for (const p of paths) {
    const v = p.split(".").reduce((x, k) => x?.[k], obj);
    if (v != null) return v;
  }
  return undefined;
}
export function getDeliveryCoord(o: any): LatLng | null {
  const c =
    pick(
      o,
      "deliveryAddress",
      "deliveryAddress.location",
      "deliveryAddress.geo",
      "shippingAddress",
      "shippingAddress.location",
      "shippingAddress.geo",
      "delivery",
      "delivery.location",
      "delivery.geo",
      "customer.location",
      "customer.address.geo",
      "location",
      "geo"
    ) ?? null;

  const fromArr =
    arrToLatLng((c as any)?.coordinates) ??
    arrToLatLng((c as any)?.coords) ??
    arrToLatLng(c);
  if (fromArr) return fromArr;

  const lat = asNum((c as any)?.lat ?? (c as any)?.latitude ?? (c as any)?.y);
  const lng = asNum(
    (c as any)?.lng ??
      (c as any)?.lon ??
      (c as any)?.long ??
      (c as any)?.longitude ??
      (c as any)?.x
  );
  if (lat != null && lng != null) return { lat, lng };

  const lat2 = asNum(o?.destLat);
  const lng2 = asNum(o?.destLng);
  return lat2 != null && lng2 != null ? { lat: lat2, lng: lng2 } : null;
}
function mockPointFor(id: string): LatLng {
  const seed = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 1000;
  const dLat = ((seed % 80) - 40) / 1000;
  const dLng = (((seed / 10) | 0) % 80 - 40) / 1000;
  return {
    lat: LOGISTIC_CENTER.lat + 0.12 + dLat,
    lng: LOGISTIC_CENTER.lng + 0.18 + dLng,
  };
}
export function pickDeliveryPoint(o: OrderRowAPI): LatLng {
  return getDeliveryCoord(o as any) ?? mockPointFor(o.id);
}

// ---------- local helpers ----------
function firstStr(...vals: any[]): string | undefined {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v;
  return undefined;
}
function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function toNumUndef(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function toIntUndef(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}
