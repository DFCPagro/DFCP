/* -------------------------------------------------------------------------- */
/*                         Market <-> Checkout Cart Bridge                    */
/*            Minimal shared util to read/write the Market cart               */
/* -------------------------------------------------------------------------- */
/**
 * How to wire:
 * 1) Open your Market page (likely `src/pages/Market/index.tsx`) and find the
 *    localStorage key it uses for the cart (e.g., "market.cart.v1").
 * 2) Put that exact string as the FIRST item in CANDIDATE_KEYS below.
 * 3) Checkout can now import { getCart, setCart, clearCart, marketItemToCartLine }
 *    and show/use the same items.
 */

import type { MarketItem } from "@/types/market";

/* ---------------------------------- Types --------------------------------- */

export type CartLine = {
  /* identity (stable key for list rendering) */
  key: string;

  /* server identity (optional but recommended for checkout preflight) */
  docId?: string;

  stockId?: string; // "<itemId>_<farmerId>"
  itemId: string;

  /* context (optional but recommended) */
  date?: string; // YYYY-MM-DD
  shift?: "morning" | "afternoon" | "evening" | "night";
  logisticCenterId?: string;
  status?: "active" | "soldout" | "removed";

  /* display */
  name: string;
  /** accepts "", null, undefined; normalized to undefined */
  imageUrl?: string;
  category?: string;

  /* provenance */
  farmerId?: string;
  farmerName?: string;
  farmName?: string;
  /** accepts "", null, undefined; normalized to undefined */
  farmLogo?: string;
  // Back-compat read fallback (deprecated):
  sourceFarmerName?: string;
  sourceFarmName?: string;

  /* pricing snapshot and qty */
  pricePerUnit: number; // snapshot at add-to-cart time
  quantity: number; // kg or units (float allowed)

  /* extra item data carried for UI/checkout logic */
  avgWeightPerUnitKg?: number;
  unitMode?: "kg" | "unit" | "mixed"; // from MarketItem.unitMode
  availableUnitsEstimate?: number; // from MarketItem.availableUnitsEstimate
  availableKg?: number; // from MarketItem.availableKg
  farmerOrderId?: string | null; // passthrough if present

  /* optional meta */
  unit?: "kg" | "unit"; // user's chosen unit for this line
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

/** Convert "", null, undefined → undefined; pass through non-empty strings */
function normalizeUrl(v: unknown): string | undefined {
  if (v === "" || v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s || undefined;
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

/* ------------------------------------------
 * Cart Context (kept in a sibling LS key)
 * ------------------------------------------ */

export type CartContext = {
  logisticCenterId: string;
  date: string; // YYYY-MM-DD
  shift: "morning" | "afternoon" | "evening" | "night";
  amsId?: string; // optional advanced field
};

function getCartContextStorageKey(): string | null {
  const cartKey = getCartStorageKey();
  return cartKey ? `${cartKey}:ctx` : null;
}

function readSavedContext(): CartContext | null {
  const k = getCartContextStorageKey();
  if (!k) return null;
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (
      obj &&
      typeof obj === "object" &&
      typeof obj.logisticCenterId === "string" &&
      typeof obj.date === "string" &&
      typeof obj.shift === "string"
    ) {
      return {
        logisticCenterId: obj.logisticCenterId.trim(),
        date: obj.date,
        shift: String(obj.shift).toLowerCase() as CartContext["shift"],
        amsId: typeof obj.amsId === "string" ? obj.amsId.trim() : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function saveContext(ctx: CartContext): void {
  const k = getCartContextStorageKey();
  if (!k) return;
  const normalized: CartContext = {
    logisticCenterId: String(ctx.logisticCenterId || "").trim(),
    date: ctx.date,
    shift: String(ctx.shift).toLowerCase() as CartContext["shift"],
    amsId: typeof ctx.amsId === "string" ? String(ctx.amsId).trim() : undefined,
  };
  localStorage.setItem(k, JSON.stringify(normalized));
}

function clearSavedContext(): void {
  const k = getCartContextStorageKey();
  if (!k) return;
  localStorage.removeItem(k);
}

function missingContextFields(
  ctx: Partial<CartContext> | undefined | null
): string[] {
  const miss: string[] = [];
  if (!ctx || !ctx.logisticCenterId) miss.push("logisticCenterId");
  if (!ctx || !ctx.date) miss.push("date");
  if (!ctx || !ctx.shift) miss.push("shift");
  return miss;
}

function contextDiff(
  a: CartContext,
  b: CartContext
): Array<{ field: keyof CartContext; saved: string; incoming: string }> {
  const diffs: Array<{
    field: keyof CartContext;
    saved: string;
    incoming: string;
  }> = [];
  if (a.logisticCenterId !== b.logisticCenterId)
    diffs.push({
      field: "logisticCenterId",
      saved: a.logisticCenterId,
      incoming: b.logisticCenterId,
    });
  if (a.date !== b.date)
    diffs.push({ field: "date", saved: a.date, incoming: b.date });
  if (a.shift !== b.shift)
    diffs.push({ field: "shift", saved: a.shift, incoming: b.shift });
  if (a.amsId !== b.amsId)
    diffs.push({ field: "amsId", saved: a.amsId, incoming: b.amsId });
  return diffs;
}

/* -------------------------------------------------------------------------- */
/*                          Normalization & Totals                            */
/* -------------------------------------------------------------------------- */

/** Normalize a single line for backward compatibility and canonical fields. */
function normalizeLine(line: any): CartLine {
  const qty = Number(line?.quantity);
  const price = Number(line?.pricePerUnit);

  // Prefer canonical farmer fields; fallback to legacy "source*" on read
  const farmerName = line?.farmerName ?? line?.sourceFarmerName ?? undefined;
  const farmName = line?.farmName ?? line?.sourceFarmName ?? undefined;

  // Prefer explicit stockId; else use provided key if it matches; else derive best-effort
  // Ensure stable stockId: prefer explicit, else from key hint, else derive from item+farmer
  let stockId: string | undefined =
    typeof line?.stockId === "string" && line.stockId.trim()
      ? line.stockId
      : typeof line?.key === "string" && line.key.includes("_")
        ? line.key
        : undefined;

  if (!stockId) {
    const itemId = typeof line?.itemId === "string" ? line.itemId : "";
    const farmerId = typeof line?.farmerId === "string" ? line.farmerId : "";
    if (itemId && farmerId) stockId = `${itemId}_${farmerId}`;
  }

  const key: string =
    typeof line?.key === "string" && line.key.trim()
      ? line.key
      : (stockId ??
        line?.itemId ??
        crypto.randomUUID?.() ??
        String(Date.now()));

  return {
    key,
    docId: line?.docId,
    stockId,
    itemId: String(line?.itemId ?? ""),

    date: line?.date,
    shift: line?.shift,
    logisticCenterId: line?.logisticCenterId,
    status: line?.status,

    name: String(line?.name ?? ""),
    imageUrl: normalizeUrl(line?.imageUrl),
    category: line?.category,

    farmerId: line?.farmerId,
    farmerName,
    farmName,
    farmLogo: normalizeUrl(line?.farmLogo),
    // keep legacy fields so older UIs that read them don't explode
    sourceFarmerName: farmerName,
    sourceFarmName: farmName,

    pricePerUnit: Number.isFinite(price) ? price : 0,
    quantity: Number.isFinite(qty) ? qty : 0,
    avgWeightPerUnitKg:
      typeof line?.avgWeightPerUnitKg === "number"
        ? line.avgWeightPerUnitKg
        : 0.02,

    // carry richer item data when present (backward-safe)
    unitMode:
      line?.unitMode === "unit" || line?.unitMode === "mixed"
        ? line.unitMode
        : "kg",
    availableUnitsEstimate:
      typeof line?.availableUnitsEstimate === "number"
        ? line.availableUnitsEstimate
        : undefined,
    availableKg:
      typeof line?.availableKg === "number" ? line.availableKg : undefined,
    farmerOrderId:
      typeof line?.farmerOrderId === "string"
        ? line.farmerOrderId
        : line?.farmerOrderId === null
          ? null
          : undefined,

    // user's chosen unit (defaults to kg)
    unit: line?.unit === "unit" ? "unit" : "kg",
    addedAt:
      typeof line?.addedAt === "string"
        ? line.addedAt
        : new Date().toISOString(),
  };
}

function normalizeSnapshot(raw: unknown): CartSnapshot {
  // Case A: { lines: [] }
  if (looksLikeSnapshot(raw)) {
    const lines = (raw as any).lines?.map?.(normalizeLine) ?? [];
    return { lines };
  }
  // Case B: plain array stored directly
  if (looksLikeLinesArray(raw)) {
    const lines = (raw as any)?.map?.(normalizeLine) ?? [];
    return { lines };
  }
  // Fallback
  return { lines: [] };
}

function computeTotals(lines: CartLine[]): CartTotals {
  const itemsSubtotal = Number(
    lines
      .reduce((sum, l) => {
        const p = Number(l.pricePerUnit) || 0;
        const q = Number(l.quantity) || 0;
        return sum + p * q;
      }, 0)
      .toFixed(2)
  );
  return {
    itemsSubtotal,
    linesCount: lines.length,
  };
}

/* -------------------------------------------------------------------------- */
/*                          Creation helper (recommended)                     */
/* -------------------------------------------------------------------------- */

/**
 * Make a cart line from a UI-flat MarketItem + user quantity.
 * Use this in the Market "Add to Cart" handler to guarantee consistent shape.
 */
export function marketItemToCartLine(
  item: MarketItem,
  quantity: number
): CartLine {
  return normalizeLine({
    key: item.stockId, // stable & unique per farmer+item
    docId: item.docId,
    stockId: item.stockId,
    itemId: item.itemId,

    date: item.date,
    shift: item.shift,
    logisticCenterId: item.logisticCenterId,
    status: item.status,

    name: item.name,
    imageUrl: item.imageUrl, // normalizeLine will clean "", null → undefined
    category: item.category,

    farmerId: item.farmerId,
    farmerName: item.farmerName,
    farmName: item.farmName,
    farmLogo: item.farmLogo,

    pricePerUnit: item.pricePerUnit,
    quantity,
    // default to 0.02 kg per unit when missing
    avgWeightPerUnitKg: item.avgWeightPerUnitKg ?? 0.02,

    // carry richer stock data (default unitMode to "unit" when absent)
    unitMode: item.unitMode ?? "unit",
    availableUnitsEstimate: item.availableUnitsEstimate,
    availableKg: item.availableKg,
    farmerOrderId: (item as any).farmerOrderId ?? undefined,

    // default user's chosen unit based on selling mode (units-first)
    unit: (item.unitMode ?? "unit") === "unit" ? "unit" : "kg",
    addedAt: new Date().toISOString(),
  });
}

/* -------------------------------------------------------------------------- */
/*                               Public API                                   */
/* -------------------------------------------------------------------------- */

/**
 * Read the current cart from localStorage, normalizing shape differences.
 * This is **read-only** unless you also call `setCart` or `clearCart`.
 */
export function getCart(context?: Partial<CartContext>): SharedCart {
  const key = getCartStorageKey();

  // 1) If caller provided a context, enforce completeness
  if (context) {
    const miss = missingContextFields(context);
    if (miss.length) {
      alert(`Missing cart context: ${miss.join(", ")}`);
      // Do not mutate anything; fall through to plain read.
    } else {
      // context is complete → normalize the incoming context
      const incoming: CartContext = {
        logisticCenterId: String(context.logisticCenterId!).trim(),
        date: String(context.date!),
        shift: String(context.shift!).toLowerCase() as CartContext["shift"],
        amsId:
          typeof context.amsId === "string"
            ? String(context.amsId).trim()
            : undefined,
      };

      const saved = readSavedContext();

      if (!saved) {
        // Edge case #2: Saved context missing → clear cart for safety
        console.log(
          "[Cart] Cleared: no saved context found. Saving incoming context.",
          incoming
        );
        clearCart(); // will also clear context key (see clearCart change)
        saveContext(incoming);
      } else {
        // Compare and clear if any field differs; also log exact diffs
        const diffs = contextDiff(saved, incoming);
        if (diffs.length) {
          console.log("[Cart] Cleared due to context change:", diffs);
          clearCart();
          saveContext(incoming);
        }
      }
    }
  }

  // 2) Plain read as before
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
export function setCart(
  next: CartSnapshot,
  context?: Partial<CartContext>
): void {
  const key = getCartStorageKey();
  if (!key) return;

  if (context) {
    const miss = missingContextFields(context);
    if (miss.length) {
      alert(`Missing cart context: ${miss.join(", ")}`);
      return; // safer: refuse to write with incomplete context
    }
    const incoming: CartContext = {
      logisticCenterId: String(context.logisticCenterId!).trim(),
      date: String(context.date!),
      shift: String(context.shift!).toLowerCase() as CartContext["shift"],
      amsId:
        typeof context.amsId === "string"
          ? String(context.amsId).trim()
          : undefined,
    };
    const saved = readSavedContext();
    if (!saved) {
      console.log(
        "[Cart] setCart(): no saved context; clearing then writing snapshot.",
        incoming
      );
      clearCart();
      saveContext(incoming);
    } else {
      const diffs = contextDiff(saved, incoming);
      if (diffs.length) {
        console.log(
          "[Cart] setCart(): context changed; clearing then writing snapshot.",
          diffs
        );
        clearCart();
        saveContext(incoming);
      }
    }
  }

  localStorage.setItem(key, JSON.stringify(next));
}

/** Clear the cart completely (use after successful order). */
export function clearCart(): void {
  const key = getCartStorageKey();
  if (!key) return;
  localStorage.removeItem(key);
  clearSavedContext(); // NEW: also drop the saved context
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
