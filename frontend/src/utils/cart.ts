// src/utils/cart.ts
export type CartLine = {
  inventoryId: string;
  name: string;
  price: number;
  imageUrl?: string;
  farmer?: { name?: string; farmName?: string };
  qty: number;
  maxQty?: number; // optional cap (e.g., current stock)
};

const KEY = "cart_v1";

function read(): CartLine[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function totals(items: CartLine[]) {
  const count = items.reduce((s, l) => s + l.qty, 0);
  const subtotal = items.reduce((s, l) => s + l.qty * (l.price ?? 0), 0);
  return { count, subtotal };
}
function write(items: CartLine[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(
    new CustomEvent("cart:change", { detail: { items, totals: totals(items) } })
  );
}

export function getCart(): CartLine[] { return read(); }
export function clearCart() { write([]); }

export function addToCart(line: CartLine) {
  const items = read();
  const i = items.findIndex((x) => x.inventoryId === line.inventoryId);
  if (i >= 0) {
    const next = items[i];
    const cap = line.maxQty ?? Infinity;
    next.qty = Math.max(1, Math.min((next.qty || 0) + line.qty, cap));
  } else {
    const cap = line.maxQty ?? Infinity;
    items.push({ ...line, qty: Math.max(1, Math.min(line.qty, cap)) });
  }
  write(items);
}

export function setQty(inventoryId: string, qty: number) {
  const items = read();
  const i = items.findIndex((x) => x.inventoryId === inventoryId);
  if (i >= 0) {
    if (qty <= 0) items.splice(i, 1);
    else items[i].qty = qty;
    write(items);
  }
}

export function removeFromCart(inventoryId: string) {
  const items = read().filter((x) => x.inventoryId !== inventoryId);
  write(items);
}

export function subscribeCart(listener: (data: { items: CartLine[]; totals: { count: number; subtotal: number } }) => void) {
  const fn = (e: Event) => {
    listener((e as CustomEvent).detail);
  };
  window.addEventListener("cart:change", fn);
  // emit current state immediately
  listener({ items: read(), totals: totals(read()) });
  return () => window.removeEventListener("cart:change", fn);
}
