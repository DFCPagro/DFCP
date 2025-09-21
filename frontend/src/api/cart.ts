import { api } from "@/api/config"; // adjust import if your api path differs

// ===== Types from OpenAPI =====
export type ShiftName = "morning" | "afternoon" | "evening" | "night";

export interface CartItem {
  _id: string;
  availableMarketStockItemId: string;
  itemId: string;
  displayName: string;
  category: string;
  imageUrl: string | null;
  pricePerUnit: number;
  amountKg: number;
  addedAt: string;   // ISO
  updatedAt: string; // ISO
}

export type CartStatus = "active" | "abandoned" | "expired" | "checkedout";

export interface Cart {
  _id: string;
  userId: string;
  LCid: string; // LogisticsCenter _id
  availableMarketStockId: string;
  availableDate: string; // ISO, normalized to 00:00 UTC
  availableShift: ShiftName;
  items: CartItem[];
  status: CartStatus;
  lastActivityAt: string; // ISO
  expiresAt: string;      // ISO
}

export interface AddItemInput {
  availableMarketStockId: string;
  amsItemId: string;
  amountKg: number; // >= 0.001
  inactivityMinutesOverride?: number; // >= 1
}

export interface RemoveItemInput {
  /** If omitted entirely, remove whole line */
  amountKg?: number; // >= 0.001
}

export interface WipeShiftInput {
  availableDate: string; // ISO at 00:00:00.000Z (UTC)
  shiftName: ShiftName;
  hardDelete?: boolean; // default false
}

// Optional per-call options (e.g., AbortController)
export interface RequestOpts {
  signal?: AbortSignal;
}

// ===== Routes =====

// GET /carts/active?ams=...
export async function getActiveCart(
  ams: string,
  opts?: RequestOpts
): Promise<Cart | null> {
  const { data } = await api.get<Cart | null>("/carts/active", {
    params: { ams },
    signal: opts?.signal,
  });
  return data;
}

// GET /carts/{cartId}
export async function getCart(
  cartId: string,
  opts?: RequestOpts
): Promise<Cart> {
  const { data } = await api.get<Cart>(`/carts/${encodeURIComponent(cartId)}`, {
    signal: opts?.signal,
  });
  return data;
}

// POST /carts/add
export async function addToCart(
  payload: AddItemInput,
  opts?: RequestOpts
): Promise<Cart> {
  const { data } = await api.post<Cart>("/carts/add", payload, {
    signal: opts?.signal,
  });
  return data;
}

// PATCH /carts/{cartId}/items/{cartItemId}
// Pass {} to remove entire line, or { amountKg } to remove partial quantity
export async function updateCartItem(
  cartId: string,
  cartItemId: string,
  body?: RemoveItemInput,
  opts?: RequestOpts
): Promise<Cart> {
  const { data } = await api.patch<Cart>(
    `/carts/${encodeURIComponent(cartId)}/items/${encodeURIComponent(cartItemId)}`,
    body ?? {},
    { signal: opts?.signal }
  );
  return data;
}

// POST /carts/{cartId}/clear  -> 204 No Content
export async function clearCart(cartId: string, opts?: RequestOpts): Promise<void> {
  await api.post<void>(
    `/carts/${encodeURIComponent(cartId)}/clear`,
    undefined,
    { signal: opts?.signal }
  );
}

// POST /carts/{cartId}/checkout
export async function checkoutCart(
  cartId: string,
  opts?: RequestOpts
): Promise<Cart> {
  const { data } = await api.post<Cart>(
    `/carts/${encodeURIComponent(cartId)}/checkout`,
    undefined,
    { signal: opts?.signal }
  );
  return data;
}

// POST /carts/{cartId}/refresh-expiry
export async function refreshCartExpiry(
  cartId: string,
  opts?: RequestOpts
): Promise<Cart> {
  const { data } = await api.post<Cart>(
    `/carts/${encodeURIComponent(cartId)}/refresh-expiry`,
    undefined,
    { signal: opts?.signal }
  );
  return data;
}

// POST /carts/wipe-shift  -> 204 No Content (Admin)
export async function wipeShift(
  payload: WipeShiftInput,
  opts?: RequestOpts
): Promise<void> {
  await api.post<void>("/carts/wipe-shift", payload, { signal: opts?.signal });
}
