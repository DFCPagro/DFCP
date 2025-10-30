// src/pages/CreateStock/types.ts
// Shared types for the Create Stock flow (page, hooks, and components).
// We intentionally keep these FE-only and aligned with your BE contracts.
// TODO(real API): When BE DTOs are finalized, replace/align these with the actual shared types.

import type { ShiftEnum, IsoDateString } from "@/types/shifts";

/* -----------------------------------------------------------------------------
 * Init (available-stock/init)
 * ---------------------------------------------------------------------------*/

// Hook status helpers for simple FSMs in the page/components.

/** Result we expect back from `/api/available-stock/init` */
export type InitResult = {
  /** Available Market Stock id (AMS) returned by init */
  amsId: string;
  /** Whether the AMS was newly created; BE may return same shape for "found" */
  created: boolean;
  /** Echo of the init inputs for convenience */
  date: IsoDateString;
  shift: ShiftEnum;
};

/** Minimal payload to request init (handy for tests or future refactors) */
export type InitPayload = {
  date: IsoDateString;
  shift: ShiftEnum;
};

/* -----------------------------------------------------------------------------
 * Farmer Inventory (listing after init)
 * ---------------------------------------------------------------------------*/

/** Single inventory item as returned by the BE (exactly mirrors your sample) */

/** Paginated response shape from BE (we'll ignore pagination for v1 UI) */

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
  shift?: ShiftEnum; // "morning" | "afternoon" | "evening" | "night"
};

/* -----------------------------------------------------------------------------
 * Component helpers
 * ---------------------------------------------------------------------------*/
