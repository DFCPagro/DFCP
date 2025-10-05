/* -------------------------------------------------------------------------- */
/*                         Market <-> Checkout Cart Bridge                    */
/*            Minimal shared util to read/write the Market cart               */
/* -------------------------------------------------------------------------- */
/**
 * How to wire:
 * 1) Open your Market page (likely `src/pages/Market/index.tsx`) and find the
 *    localStorage key it uses for the cart (e.g., "market.cart.v1").
 * 2) Put that exact string as the FIRST item in CANDIDATE_KEYS below.
 * 3) Checkout can now import { getCart, clearCart } and show the same items.
 */

export type CartLine = {
  // identity (stable key for list rendering)
  key: string; // e.g., `${itemId}_${farmerId}` or `${stockId}`

  // item identity
  itemId: string;
  farmerOrderId?: string;
  stockId?: string;

  // display
  name: string;
  imageUrl?: string;
  category?: string;
  sourceFarmerName?: string;
  sourceFarmName?: string;

  // pricing snapshot and qty
  pricePerUnit: number; // snapshot at add-to-cart time
  quantity: number;     // kg or units (float allowed)

  // optional meta
  unit?: "kg" | "unit";
  addedAt?: string; // ISO
};

export type CartSnapshot = {
  lines: CartLine[];
};

export type CartTotals = {
  /** Sum of (pricePerUnit * quantity) across all lines */
  itemsSubtotal: number;
  /** Count of lines (not total units) */
  linesCount: number;
};

export type SharedCart = CartSnapshot & {
  totals: CartTotals;
  /** The storage key that was used/resolved */
  storageKey: string | null;
};

/* -------------------------------------------------------------------------- */
/*                         Storage Key Detection (Tiny)                       */
/* -------------------------------------------------------------------------- */

/**
 * Put the real Market cart key FIRST.
 * We include a few fallbacks so this file is drop-in without breaking anything.
 */
const CANDIDATE_KEYS = [
  // ⚠️ Replace the first entry with your real key from Market/index.tsx:
  "market.cart.v1",
  "market.selection.v2",
  // plausible fallbacks (safe to keep)
  "sm.cart.v1",
  "simpleMarket.cart",
  "marketCart",
  "cart",
] as const;

function safeParse<T = unknown>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function looksLikeLinesArray(val: unknown): val is CartLine[] {
  return Array.isArray(val) && (val.length === 0 || typeof val[0] === "object");
}

function looksLikeSnapshot(val: unknown): val is CartSnapshot {
  return (
    !!val &&
    typeof val === "object" &&
    "lines" in (val as any) &&
    Array.isArray((val as any).lines)
  );
}

/**
 * Try candidates first; if none hit, scan localStorage for a likely match.
 */
function resolveCartKey(): string | null {
  // 1) Try known candidates in order
  for (const key of CANDIDATE_KEYS) {
    const parsed = safeParse(localStorage.getItem(key));
    if (looksLikeSnapshot(parsed) || looksLikeLinesArray(parsed)) {
      return key;
    }
  }

  // 2) Heuristic: scan all keys to find an object { lines: [...] } or an array
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const parsed = safeParse(localStorage.getItem(key));
    if (looksLikeSnapshot(parsed) || looksLikeLinesArray(parsed)) {
      return key;
    }
  }

  // 3) Nothing found (fresh browser) → use the first candidate as default home
  return CANDIDATE_KEYS[0] ?? null;
}

let _resolvedKey: string | null = null;

/** Returns the resolved storage key (memoized). */
export function getCartStorageKey(): string | null {
  if (_resolvedKey !== null) return _resolvedKey;
  _resolvedKey = resolveCartKey();
  return _resolvedKey;
}

/* -------------------------------------------------------------------------- */
/*                          Normalization & Totals                            */
/* -------------------------------------------------------------------------- */

function normalizeSnapshot(raw: unknown): CartSnapshot {
  // Case A: { lines: [] }
  if (looksLikeSnapshot(raw)) {
    return { lines: raw.lines ?? [] };
  }
  // Case B: plain array stored directly
  if (looksLikeLinesArray(raw)) {
    return { lines: raw ?? [] };
  }
  // Fallback
  return { lines: [] };
}

function computeTotals(lines: CartLine[]): CartTotals {
  const itemsSubtotal = Number(
    lines.reduce((sum, l) => sum + (Number(l.pricePerUnit) || 0) * (Number(l.quantity) || 0), 0).toFixed(2)
  );
  return {
    itemsSubtotal,
    linesCount: lines.length,
  };
}

/* -------------------------------------------------------------------------- */
/*                               Public API                                   */
/* -------------------------------------------------------------------------- */

/**
 * Read the current cart from localStorage, normalizing shape differences.
 * This is **read-only** unless you also call `setCart` or `clearCart`.
 */
export function getCart(): SharedCart {
  const key = getCartStorageKey();
  const parsed = safeParse(localStorage.getItem(key ?? "")); // may be null
  const snap = normalizeSnapshot(parsed);
  return {
    ...snap,
    totals: computeTotals(snap.lines),
    storageKey: key,
  };
}

/**
 * Overwrite the cart snapshot in localStorage (optional use in Checkout).
 * If you only need to *clear* after order placement, prefer `clearCart()`.
 */
export function setCart(next: CartSnapshot): void {
  const key = getCartStorageKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(next));
}

/** Clear the cart completely (use after successful order). */
export function clearCart(): void {
  const key = getCartStorageKey();
  if (!key) return;
  localStorage.removeItem(key);
}

/**
 * Subscribe to cross-tab updates. Useful if Market and Checkout are in
 * different tabs and should stay in sync. Call the returned cleanup on unmount.
 *
 * Example:
 *   const off = subscribeCart(() => setState(getCart()));
 *   return () => off();
 */
export function subscribeCart(onChange: () => void): () => void {
  const handler = (ev: StorageEvent) => {
    const key = getCartStorageKey();
    if (!key) return;
    if (ev.key === key) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
