/* -------------------------------------------------------------------------- */
/*                      CreateStock <-> Submitted Orders Store                 */
/*     Minimal shared util to read/write locally persisted submissions         */
/* -------------------------------------------------------------------------- */
/**
 * How to wire:
 * - After a successful server create(req), call:
 *     addSubmitted(line, context)
 *   where `line` mirrors what you want to appear in the summary dialog.
 *
 * - To render UI:
 *     const snap = getSubmitted();
 *     const isSubmitted = hasAnySubmissionForRow(rowKey);
 *     const groups = groupSubmitted(snap.lines); // by itemId+type+variety
 *
 * - On "Confirm" in the dialog:
 *     clearSubmitted();
 *
 * Notes:
 * - This store allows multiple submissions for the *same* rowKey
 *   (per your debugging decision). The row can still be locked in UI by
 *   checking `hasAnySubmissionForRow(rowKey)`.
 * - Context (date, shift, logisticCenterId) is saved. If context differs
 *   from the last saved one, we clear and start fresh—just like marketCart.
 */

/* ---------------------------------- Types --------------------------------- */

export type SubmittedContext = {
  /** YYYY-MM-DD */
  date: string;
  /** "morning" | "afternoon" | "evening" | "night" */
  shift: string;
  // logisticCenterId: string;
  /** Optional: helpful if page is scoped by AMS or similar */
  amsId?: string;
};

export type SubmittedLine = {
  /** Stable per-row key used by your list rendering (e.g., itemId_farmerId) */
  key: string;

  /* Item identity */
  itemId: string;
  type?: string | null;
  variety?: string | null;
  imageUrl?: string | null;

  /* Provenance */
  farmerId: string;
  farmerName?: string | null;
  farmName?: string | null;

  /* Numbers */
  qtyKg: number;

  /* group*/
  groupDemandKg: number;
  /* Timestamps */
  submittedAt: string; // ISO string
};

export type SubmittedSnapshot = {
  lines: SubmittedLine[];
};

export type SubmittedTotals = {
  linesCount: number;
  totalKg: number;
};

export type SubmittedGroupKey = string;

export type SubmittedGroup = {
  groupKey: SubmittedGroupKey; // `${itemId}__${type ?? ""}__${variety ?? ""}`
  itemId: string;
  type?: string | null;
  variety?: string | null;
  totalSubmittedKg: number;
  remainingKg?: number;
  demandKg?: number;
  lines: SubmittedLine[];
};

/* ------------------------------ Storage Keys ------------------------------ */

/** Main payload key (lines). Bump version when structure changes. */
const SUBMITTED_KEYS = [
  "createStock.submitted.v1",
  // (optional legacy fallbacks could go here)
] as const;

const CTX_KEYS = ["createStock.submitted.v1:ctx"] as const;

function getSubmittedStorageKey(): string | null {
  for (const k of SUBMITTED_KEYS) {
    const maybe = localStorage.getItem(k);
    if (maybe != null) return k;
  }
  // default to the first (current) key
  return SUBMITTED_KEYS[0] ?? null;
}

function getSubmittedContextStorageKey(): string | null {
  for (const k of CTX_KEYS) {
    const maybe = localStorage.getItem(k);
    if (maybe != null) return k;
  }
  return CTX_KEYS[0] ?? null;
}

/* --------------------------------- Helpers -------------------------------- */

function safeParse<T = unknown>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeNullable<T>(v: T | null | undefined): T | undefined {
  return v == null || (typeof v === "string" && v.trim() === "")
    ? (undefined as any)
    : v;
}

function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function contextDiff(
  a: SubmittedContext | null,
  b: SubmittedContext | null
): Array<keyof SubmittedContext> {
  const diffs: Array<keyof SubmittedContext> = [];
  if (!a && b)
    return [
      "date",
      "shift",
      // "logisticCenterId",
      ...(b.amsId ? (["amsId"] as const) : []),
    ];
  if (a && !b)
    return [
      "date",
      "shift",
      // "logisticCenterId",
      ...(a.amsId ? (["amsId"] as const) : []),
    ];
  if (!a && !b) return diffs;
  if (!a || !b) return diffs;
  if (a.date !== b.date) diffs.push("date");
  if (a.shift !== b.shift) diffs.push("shift");
  // if (a.logisticCenterId !== b.logisticCenterId) diffs.push("logisticCenterId");
  if (a.amsId !== b.amsId) diffs.push("amsId");
  return diffs;
}

function readSavedContext(): SubmittedContext | null {
  const k = getSubmittedContextStorageKey();
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
      return obj as SubmittedContext;
    }
    return null;
  } catch {
    return null;
  }
}

function saveContext(ctx: SubmittedContext): void {
  const k = getSubmittedContextStorageKey();
  if (!k) return;
  localStorage.setItem(k, JSON.stringify(ctx));
}

/* ------------------------------ Read / Write ------------------------------ */

/** Read snapshot from storage (returns empty snapshot if nothing found). */
export function getSubmitted(): SubmittedSnapshot {
  const key = getSubmittedStorageKey();
  if (!key) return { lines: [] };
  const parsed = safeParse<SubmittedSnapshot>(localStorage.getItem(key));
  if (!parsed || !Array.isArray(parsed.lines)) return { lines: [] };

  // Normalize nullable strings to undefined for consistency
  const lines = parsed.lines.map((l) => ({
    ...l,
    type: normalizeNullable(l.type ?? null),
    variety: normalizeNullable(l.variety ?? null),
    imageUrl: normalizeNullable(l.imageUrl ?? null),
    farmerName: normalizeNullable(l.farmerName ?? null),
    farmName: normalizeNullable(l.farmName ?? null),
  }));

  return { lines };
}

/** Overwrite snapshot (handles context changes like marketCart). */
export function setSubmitted(
  next: SubmittedSnapshot,
  incomingContext?: SubmittedContext | null
): void {
  const key = getSubmittedStorageKey();
  if (!key) return;

  // Guard context
  if (incomingContext) {
    const saved = readSavedContext();
    if (!saved) {
      saveContext(incomingContext);
    } else {
      const diffs = contextDiff(saved, incomingContext);
      if (diffs.length) {
        // context changed => clear and save new context
        clearSubmitted();
        saveContext(incomingContext);
      }
    }
  }

  localStorage.setItem(key, JSON.stringify({ lines: next.lines ?? [] }));
}

/** Clear snapshot + keep/refresh context if provided. */
export function clearSubmitted(newContext?: SubmittedContext | null): void {
  const key = getSubmittedStorageKey();
  if (key) localStorage.removeItem(key);
  const ctxKey = getSubmittedContextStorageKey();
  if (ctxKey && newContext) {
    localStorage.setItem(ctxKey, JSON.stringify(newContext));
  }
}

/**
 * Append a new submitted line. Allows multiple lines for the same `key`
 * (as per your debugging preference). Also guards context drift.
 */
export function addSubmitted(
  line: SubmittedLine,
  incomingContext: SubmittedContext
): void {
  // Normalize fields
  const nextLine: SubmittedLine = {
    ...line,
    type: normalizeNullable(line.type ?? null),
    variety: normalizeNullable(line.variety ?? null),
    imageUrl: normalizeNullable(line.imageUrl ?? null),
    farmerName: normalizeNullable(line.farmerName ?? null),
    farmName: normalizeNullable(line.farmName ?? null),
    submittedAt: line.submittedAt ?? new Date().toISOString(),
  };

  // Context check
  const saved = readSavedContext();
  const diffs = contextDiff(saved, incomingContext);
  if (diffs.length) {
    // Context changed: clear and start new snapshot with this line
    clearSubmitted(incomingContext);
    setSubmitted({ lines: [nextLine] }, incomingContext);
    return;
  }
  if (!saved) {
    // First-time save
    saveContext(incomingContext);
  }

  // Append
  const current = getSubmitted();
  const next = { lines: [...current.lines, nextLine] };
  setSubmitted(next, incomingContext);
}

/* --------------------------------- Queries -------------------------------- */

export function getTotals(): SubmittedTotals {
  const { lines } = getSubmitted();
  const totalKg = lines.reduce(
    (acc, l) => acc + (Number.isFinite(l.qtyKg) ? l.qtyKg : 0),
    0
  );
  return { linesCount: lines.length, totalKg };
}

export function hasAnySubmissionForRow(rowKey: string): boolean {
  const { lines } = getSubmitted();
  return lines.some((l) => l.key === rowKey);
}

/** Composite grouping key `${itemId}__${type ?? ""}__${variety ?? ""}` */
export function toGroupKey(
  itemId: string,
  type?: string | null,
  variety?: string | null
): SubmittedGroupKey {
  return `${itemId}__${type ?? ""}__${variety ?? ""}`;
}

/** Group lines by item (itemId + type + variety) for the summary dialog. */
export function groupSubmitted(lines: SubmittedLine[]): SubmittedGroup[] {
  const map = new Map<SubmittedGroupKey, SubmittedGroup>();
  for (const l of lines) {
    const gk = toGroupKey(l.itemId, l.type, l.variety);
    const existing = map.get(gk);
    if (!existing) {
      map.set(gk, {
        groupKey: gk,
        itemId: l.itemId,
        type: l.type,
        variety: l.variety,
        demandKg: l.groupDemandKg,
        totalSubmittedKg: Number.isFinite(l.qtyKg) ? l.qtyKg : 0,
        lines: [l],
      });
    } else {
      existing.lines.push(l);
      existing.totalSubmittedKg += Number.isFinite(l.qtyKg) ? l.qtyKg : 0;
    }
  }
  return Array.from(map.values());
}

/* ---------------------------- Cross-Tab (Optional) ---------------------------- */
/**
 * Not required for your current flow, but handy if you ever open two tabs.
 * Use like:
 *   const off = subscribeSubmitted(() => set(s => getSubmitted()));
 *   return () => off();
 */
export function subscribeSubmitted(onChange: () => void): () => void {
  const handler = (ev: StorageEvent) => {
    const key = getSubmittedStorageKey();
    if (!key) return;
    if (ev.key === key) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/* ---------------------------------- Examples --------------------------------- */
/*
import { addSubmitted, getSubmitted, groupSubmitted, hasAnySubmissionForRow, clearSubmitted } from
  "./shared/submittedOrders.shared";

// After successful API:
addSubmitted({
  key: getRowKey(row),
  itemId,
  type: demand.type,
  variety: demand.variety,
  imageUrl: demand.imageUrl,
  farmerId: row.farmerUserId,
  farmerName: row.farmerName,
  farmName: row.farmName,
  qtyKg: parsed,
  submittedAt: new Date().toISOString(),
}, { date: pickUpDate, shift, logisticCenterId });

// In row UI:
const locked = hasAnySubmissionForRow(getRowKey(row)); // -> disables input & shows "Submitted"

// In dialog:
const { lines } = getSubmitted();
const groups = groupSubmitted(lines);

// On Confirm:
clearSubmitted();
*/
