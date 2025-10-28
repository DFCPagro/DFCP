// src/pages/CreateStock/types.ts
// Shared types for the Create Stock flow (page, hooks, and components).
// We intentionally keep these FE-only and aligned with your BE contracts.
// TODO(real API): When BE DTOs are finalized, replace/align these with the actual shared types.

import type { Shift, IsoDateString } from "@/types/farmerOrders";

/* -----------------------------------------------------------------------------
 * Init (available-stock/init)
 * ---------------------------------------------------------------------------*/

// Hook status helpers for simple FSMs in the page/components.
export type AsyncStatus = "idle" | "loading" | "success" | "error";

/** Result we expect back from `/api/available-stock/init` */
export type InitResult = {
  /** Available Market Stock id (AMS) returned by init */
  amsId: string;
  /** Whether the AMS was newly created; BE may return same shape for "found" */
  created: boolean;
  /** Echo of the init inputs for convenience */
  date: IsoDateString;
  shift: Shift;
};

/** Minimal payload to request init (handy for tests or future refactors) */
export type InitPayload = {
  date: IsoDateString;
  shift: Shift;
};

/* -----------------------------------------------------------------------------
 * Farmer Inventory (listing after init)
 * ---------------------------------------------------------------------------*/

/** Single inventory item as returned by the BE (exactly mirrors your sample) */
export type FarmerInventoryItem = {
  id: string; // inventory row id
  farmerId: string; // show ID for now (no name lookup)
  itemId: string;
  logisticCenterId: string;
  agreementAmountKg: number;
  currentAvailableAmountKg: number;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp (used as "last updated")
  // NOTE: "forecasted" is intentionally ignored for now per product decision.
};

/** Paginated response shape from BE (we'll ignore pagination for v1 UI) */
export type FarmerInventoryResponse = {
  data: FarmerInventoryItem[];
  page: number;
  limit: number;
  total: number;
  // TODO(real API): If BE later adds additional metadata (sort, filter echo), extend here.
};

/* -----------------------------------------------------------------------------
 * Create Farmer Order (per inventory item)
 * ---------------------------------------------------------------------------*/

/** Minimal input to create a farmer order from an inventory item */
export type CreateFarmerOrderInput = {
  amsId: string;
  itemId: string;
  // TODO(future): add quantity/unitMode/notes when UX supports it.
};

/** Minimal result from creating a farmer order (fake for now) */
export type CreateFarmerOrderResult = {
  orderId: string; // mock id in FE for now; replace with BE field when ready
  createdAtIso: string;
  // TODO(real API): add any BE-returned fields we want to reflect in UI.
};

/* -----------------------------------------------------------------------------
 * URL Query Params contract
 * ---------------------------------------------------------------------------*/

export type CreateStockQuery = {
  date?: IsoDateString; // YYYY-MM-DD local date
  shift?: Shift; // "morning" | "afternoon" | "evening" | "night"
};

/* -----------------------------------------------------------------------------
 * Component helpers
 * ---------------------------------------------------------------------------*/

/** Derived, view-focused fields we may compute in mappers/selectors */
export type InventoryViewModel = FarmerInventoryItem & {
  /** Short label for farmer (we show IDs for now) */
  farmerLabel: string;
  /** Human-friendly last updated (pre-formatted string) */
  lastUpdatedLabel: string;
  /** Whether the submit button should be disabled by rule (available ≤ 0) */
  isSubmitDisabled: boolean;
};
