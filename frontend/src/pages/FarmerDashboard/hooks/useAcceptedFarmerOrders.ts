// src/pages/FarmerDashboard/hooks/useAcceptedFarmerOrders.ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listFarmerOrders } from "@/api/farmerOrders";
import type { FarmerOrderDTO, Shift } from "@/types/farmerOrders";

/** Local view models (kept private to the hook) */
export type AcceptedItemRow = {
  /** Merged-row id; composite of type+variety for stable keying in the UI */
  id: string;
  type: string;
  variety: string;

  /**
   * The quantity used for calculations and display.
   * Computed as sum(order.final ?? order.forcasted) across merged orders.
   */
  quantityKg: number;

  /**
   * If any merged order had a final value, we set finalQuantityKg to the total effective quantity
   * and leave forcastedQuantityKg as the sum of the forecast-only orders (informational).
   * If none had final, finalQuantityKg=null and forcastedQuantityKg holds the total effective.
   */
  forcastedQuantityKg: number;
  finalQuantityKg: number | null;
};

export type AcceptedGroup = {
  key: string;           // `${pickUpDate}::${shift}`
  pickUpDate: string;    // raw "YYYY-MM-DD" (local)
  shift: Shift;
  items: AcceptedItemRow[];
};

/** Keep query key identical to the one used by useIncomingFarmerOrders' optimistic update */
const keyAccepted = () => ["farmerOrders", { status: "ok" }] as const;

export function useAcceptedFarmerOrders() {
  const query = useQuery({
    queryKey: keyAccepted(),
    queryFn: () => listFarmerOrders({ farmerStatus: "ok" }),
    staleTime: 15_000,
  });

  const groups = useMemo<AcceptedGroup[]>(() => {
    const data: FarmerOrderDTO[] = query.data ?? [];

    // Sort by date asc then by shift order for stable grouping output
    const shiftOrder: Record<Shift, number> = {
      morning: 0,
      afternoon: 1,
      evening: 2,
      night: 3,
    };

    const sorted = [...data].sort((a, b) => {
      if (a.pickUpDate !== b.pickUpDate) {
        return a.pickUpDate < b.pickUpDate ? -1 : 1;
      }
      return (shiftOrder[a.shift] ?? 0) - (shiftOrder[b.shift] ?? 0);
    });

    const groupMap = new Map<string, AcceptedGroup>();

    for (const o of sorted) {
      const gkey = `${o.pickUpDate}::${o.shift}`;
      if (!groupMap.has(gkey)) {
        groupMap.set(gkey, {
          key: gkey,
          pickUpDate: o.pickUpDate,
          shift: o.shift,
          items: [],
        });
      }
      const group = groupMap.get(gkey)!;

      // Merge by (type, variety)
      const ikey = `${o.type}::${o.variety}`;
      let item = group.items.find((it) => it.id === ikey);

      // Decide per-order effective quantity
      const hasFinal =
        typeof o.finalQuantityKg === "number" && Number.isFinite(o.finalQuantityKg);
      const effective = hasFinal ? (o.finalQuantityKg as number) : o.forcastedQuantityKg;

      if (!item) {
        item = {
          id: ikey,
          type: o.type,
          variety: o.variety,
          quantityKg: 0,
          forcastedQuantityKg: 0,
          finalQuantityKg: null,
        };
        group.items.push(item);
      }

      // Aggregate:
      // quantityKg is the sum of (final ?? forcasted) across all merged orders
      item.quantityKg += effective;

      // Track final vs forecasted sums for labeling
      if (hasFinal) {
        // When any final exists, we prefer to show "final" in the UI.
        // We set finalQuantityKg to total effective, and keep forecasted sum informational.
        item.finalQuantityKg = (item.finalQuantityKg ?? 0) + (o.finalQuantityKg as number);
      } else {
        item.forcastedQuantityKg += o.forcastedQuantityKg;
      }
    }

    // Post-process: if any final existed for an item, set finalQuantityKg to the total effective,
    // so the UI label shows "final: <total>". Otherwise, leave final=null and
    // forcastedQuantityKg=total.
    for (const g of groupMap.values()) {
      for (const it of g.items) {
        const hadAnyFinal =
          typeof it.finalQuantityKg === "number" && Number.isFinite(it.finalQuantityKg);
        if (hadAnyFinal) {
          // Promote to total effective for display consistency
          it.finalQuantityKg = it.quantityKg;
        } else {
          // No finals: the effective total equals the forecasted total
          it.finalQuantityKg = null;
          it.forcastedQuantityKg = it.quantityKg;
        }
      }

      // Optional: keep items sorted by name for stable UI
      g.items.sort((a, b) => {
        const ta = `${a.type} ${a.variety}`.toLowerCase();
        const tb = `${b.type} ${b.variety}`.toLowerCase();
        return ta < tb ? -1 : ta > tb ? 1 : 0;
      });
    }

    return Array.from(groupMap.values());
  }, [query.data]);

  return {
    /** Grouped & merged view for the Accepted Orders strip */
    groups,

    /** Query states */
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error as Error | null,

    /** Manual refetch */
    refetch: query.refetch,
  };
}
