// src/pages/FarmerManagerDashboard/hooks/useManagerShiftStats.ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ShiftName } from "@/utils/shifts";
import {
  startOfDayLocal,
  addDaysLocal,
  toDateISO,
  getCurrentAndUpcomingShiftWindows,
  SHIFTS,
  compareShift,
} from "@/utils/shifts";
import type { FarmerOrderDTO } from "@/types/farmerOrders";
// ^ Adjust the imported type name if your DTO is named differently.

// NOTE: Adjust the API import to your project. This assumes you already expose a
// function that can fetch orders in a date range. If the name differs (e.g. listFarmerOrders),
// change the import accordingly.
import { listFarmerOrders } from "@/api/farmerOrders";

export type ShiftStatsRow = {
  dateISO: string; // "YYYY-MM-DD"
  shift: ShiftName;
  counts: { pending: number; ok: number; problem: number };
};

export type UseManagerShiftStatsOptions = {
  /** Horizon in days starting today; 1 = today + tomorrow (default). */
  horizonDays?: number;
  /** Override "now" (mostly for tests). */
  now?: Date;
  /** Extra query key parts (e.g., region/team filters) so cache isolates properly. */
  cacheKeyExtras?: unknown[];
  /** Whether to enable the query (default true). */
  enabled?: boolean;
  /**
   * Optional filter applied AFTER fetching (client-side).
   * Useful if you need to narrow by region/team until a manager-specific endpoint exists.
   */
  where?: (o: FarmerOrderDTO) => boolean;
};

/**
 * Fetch orders in [today .. today+horizonDays], aggregate into per-<date, shift>
 * counts for: pending | ok | problem. Only returns CURRENT & UPCOMING shifts.
 */
export function useManagerShiftStats(options: UseManagerShiftStatsOptions = {}) {
  const {
    horizonDays = 1,
    now = new Date(),
    cacheKeyExtras = [],
    enabled = true,
    where,
  } = options;

  // Compute inclusive time range for fetching
  const rangeStart = startOfDayLocal(now);
  // end = start of day after the horizon (exclusive end instant)
  const rangeEnd = startOfDayLocal(addDaysLocal(rangeStart, horizonDays + 1));

  const queryKey = useMemo(
    () => [
      "managerShiftStats",
      toDateISO(rangeStart),
      toDateISO(rangeEnd),
      horizonDays,
      ...cacheKeyExtras,
    ],
    [rangeStart, rangeEnd, horizonDays, cacheKeyExtras]
  );

  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async () => {
      // If your API expects string ISO params, pass rangeStart.toISOString(), etc.
      // Many backends treat "to" as exclusive; this aligns with our [start, end) window.
      const res = await listFarmerOrders({
        from: rangeStart.toISOString(),
        to: rangeEnd.toISOString(),
      });
      return res as FarmerOrderDTO[];

    },
  });

  const stats: ShiftStatsRow[] = useMemo(() => {
    const items = (query.data ?? []).filter((o) => (where ? where(o) : true));

    // Seed with the "current & upcoming" shift windows so empty rows still appear with zeros.
    const windows = getCurrentAndUpcomingShiftWindows(now, horizonDays);
    const key = (d: string, s: ShiftName) => `${d}__${s}`;
    const map = new Map<string, ShiftStatsRow>();

    for (const w of windows) {
      map.set(key(w.dateISO, w.shift), {
        dateISO: w.dateISO,
        shift: w.shift,
        counts: { pending: 0, ok: 0, problem: 0 },
      });
    }

    // Helper: extract <dateISO, shift> from each order.
    for (const order of items) {
      const k = inferDateShiftKey(order, now, horizonDays);
      if (!k) continue; // Order outside windows or cannot infer
      const id = key(k.dateISO, k.shift);
      if (!map.has(id)) {
        // If the order is within [rangeStart, rangeEnd) but its shift ended already,
        // it won't be in "current & upcoming"—skip it to match the card requirement.
        continue;
      }
      const row = map.get(id)!;
      const st = normalizeStatus((order as any)?.status);
      row.counts[st] += 1;
    }

    // Sort by date asc, then by shift chronological order.
    const out = Array.from(map.values()).sort((a, b) => {
      if (a.dateISO !== b.dateISO) return a.dateISO < b.dateISO ? -1 : 1;
      return compareShift(a.shift, b.shift);
    });

    return out;
  }, [query.data, where, now, horizonDays]);

  return {
    stats,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/* --------------------------------- helpers -------------------------------- */

type StatusBucket = "pending" | "ok" | "problem";

/** Strict 3-status model, as you requested. */
function normalizeStatus(s: unknown): StatusBucket {
  switch (s) {
    case "ok":
    case "approved": // tolerate synonymous value in case API uses it
    case "accepted":
      return "ok";
    case "problem":
    case "error":
    case "rejected":
      return "problem";
    default:
      return "pending";
  }
}

function inferDateShiftKey(
  order: FarmerOrderDTO,
  now: Date,
  horizonDays: number
): { dateISO: string; shift: ShiftName } | null {
  // 1) If the order already provides dateISO + shift in our canonical names, prefer that.
  const o: any = order as any;
  const explicitShift: ShiftName | undefined = SHIFTS.includes(o?.shift)
    ? (o.shift as ShiftName)
    : undefined;

  const explicitDateISO: string | undefined =
    typeof o?.dateISO === "string" ? (o.dateISO as string) :
    typeof o?.date === "string" ? (o.date as string) :
    typeof o?.deliveryDateISO === "string" ? (o.deliveryDateISO as string) :
    undefined;

  if (explicitShift && explicitDateISO) {
    return { dateISO: explicitDateISO, shift: explicitShift };
  }

  // 2) Otherwise, infer from a timestamp field by matching it to one of our windows.
  const ts =
    parseMaybeDate(o?.scheduledAt) ??
    parseMaybeDate(o?.deliveryAt) ??
    parseMaybeDate(o?.createdAt) ??
    null;

  if (!ts) return null;

  const windows = getCurrentAndUpcomingShiftWindows(now, horizonDays);
  for (const w of windows) {
    if (ts >= w.start && ts < w.end) {
      return { dateISO: w.dateISO, shift: w.shift };
    }
  }

  // If it didn't fit into "current & upcoming", treat as out-of-scope for this card.
  return null;
}

function parseMaybeDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "number") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
