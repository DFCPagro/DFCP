// src/utils/cart.ts
export type CartLine = {
  inventoryId: string;
  name: string;
  price: number;
  imageUrl?: string;
  farmer?: { name?: string; farmName?: string };
  qty: number;
  /** current cap (e.g., live available stock after reservations) */
  maxQty?: number;
};

export type CartTotals = { count: number; subtotal: number };
export type CartMeta = {
  locationKey?: string | null;
  logisticCenterId?: string | null;
  shiftKey?: string | null;
};

const KEY = "cart_v1";
const META_KEY = "cart_meta_v1";

export const CART_EVENT = "cart:change";
export const CART_EVENT_LEGACY = "cart:updated";

/* ------------------------------- storage IO ------------------------------- */
function read(): CartLine[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(items: CartLine[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  emit({ items, totals: totals(items) });
}
function readMeta(): CartMeta {
  try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); } catch { return {}; }
}
function writeMeta(next: CartMeta) {
  localStorage.setItem(META_KEY, JSON.stringify(next));
  // notify listeners that meta may impact UI (location/shift auto-pick)
  emit({ items: read(), totals: totals(read()) });
}

/* --------------------------------- totals --------------------------------- */
function totals(items: CartLine[]): CartTotals {
  const count = items.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const subtotal = items.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  return { count, subtotal };
}

/* --------------------------------- events --------------------------------- */
function emit(detail: { items: CartLine[]; totals: CartTotals }) {
  try { window.dispatchEvent(new CustomEvent(CART_EVENT, { detail })); } catch {}
  try { window.dispatchEvent(new CustomEvent(CART_EVENT_LEGACY, { detail })); } catch {}
  try { window.dispatchEvent(new StorageEvent("storage", { key: KEY })); } catch {}
}

export function onCartUpdated(handler: (data: { items: CartLine[]; totals: CartTotals }) => void) {
  const h = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(CART_EVENT, h);
  window.addEventListener(CART_EVENT_LEGACY, h);
  // fire immediately
  handler({ items: read(), totals: totals(read()) });
  return () => {
    window.removeEventListener(CART_EVENT, h);
    window.removeEventListener(CART_EVENT_LEGACY, h);
  };
}

/* ----------------------------------- API ---------------------------------- */
// Lines
export function getCart(): CartLine[] { return read(); }
export function getTotals(): CartTotals { return totals(read()); }
export function clearCart() { write([]); }

export function addToCart(line: CartLine) {
  const items = read();
  const idx = items.findIndex((x) => x.inventoryId === line.inventoryId);

  const incomingCap = Number.isFinite(line.maxQty as number) ? (line.maxQty as number) : Infinity;

  if (idx >= 0) {
    const next = { ...items[idx] };
    const existingCap = Number.isFinite(next.maxQty as number) ? (next.maxQty as number) : Infinity;
    const cap = Math.min(existingCap, incomingCap);
    const prevQty = Number(next.qty) || 0;
    const addQty = Number(line.qty) || 0;
    next.qty = Math.max(1, Math.min(prevQty + addQty, cap));
    // keep the tighter cap
    next.maxQty = Number.isFinite(cap) ? cap : undefined;
    items[idx] = next;
  } else {
    const cap = incomingCap;
    const q = Math.max(1, Math.min(Number(line.qty) || 1, cap));
    items.push({ ...line, qty: q, maxQty: Number.isFinite(cap) ? cap : undefined });
  }

  write(items);
}

export function setQty(inventoryId: string, qty: number) {
  const items = read();
  const i = items.findIndex((x) => x.inventoryId === inventoryId);
  if (i >= 0) {
    if (qty <= 0) items.splice(i, 1);
    else {
      const cap = Number.isFinite(items[i].maxQty as number) ? (items[i].maxQty as number) : Infinity;
      items[i].qty = Math.max(1, Math.min(Math.floor(qty), cap));
    }
    write(items);
  }
}

export function removeFromCart(inventoryId: string) {
  const items = read().filter((x) => x.inventoryId !== inventoryId);
  write(items);
}

/** Subscribe to cart changes (fires immediately). */
export function subscribeCart(
  listener: (data: { items: CartLine[]; totals: CartTotals }) => void
) {
  const fn = (e: Event) => listener((e as CustomEvent).detail);
  window.addEventListener(CART_EVENT, fn);
  listener({ items: read(), totals: totals(read()) });
  return () => window.removeEventListener(CART_EVENT, fn);
}

// Meta
export function getCartMeta(): CartMeta { return readMeta(); }
export function setCartMeta(meta: Partial<CartMeta>) {
  const cur = readMeta();
  writeMeta({ ...cur, ...meta });
}
export function clearCartMeta() { writeMeta({}); }
