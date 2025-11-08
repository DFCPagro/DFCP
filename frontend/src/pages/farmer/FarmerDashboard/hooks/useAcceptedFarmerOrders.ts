import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listMyOrders,
  qkMyOrdersAccepted,
  FARMER_ORDER_CARD_FIELDS,
} from "@/api/farmerOrders";
import type { FarmerOrderDTO } from "@/types/farmerOrders";
import { ShiftEnum as Shift } from "@/types/shifts";

export type AcceptedItemRow = {
  id: string;
  type: string;
  variety: string;
  quantityKg: number;
  forcastedQuantityKg: number;
  finalQuantityKg: number | null;
};
export type AcceptedGroup = {
  key: string;
  pickUpDate: string;
  shift: Shift;
  items: AcceptedItemRow[];
};

export function useAcceptedFarmerOrders() {
  const query = useQuery({
    queryKey: qkMyOrdersAccepted(),
    queryFn: async () =>
      listMyOrders({
        farmerStatus: "ok",
        window: "future",
        fields: FARMER_ORDER_CARD_FIELDS as unknown as string[],
        limit: 400,
      }),
    staleTime: 15_000,
  });

  const groups = useMemo<AcceptedGroup[]>(() => {
    const data: FarmerOrderDTO[] = query.data ?? [];

    const shiftOrder: Record<Shift, number> = {
      morning: 0,
      afternoon: 1,
      evening: 2,
      night: 3,
    };

    const sorted = [...data].sort((a, b) => {
      if (a.pickUpDate !== b.pickUpDate) return a.pickUpDate < b.pickUpDate ? -1 : 1;
      return (shiftOrder[a.shift] ?? 0) - (shiftOrder[b.shift] ?? 0);
    });

    const map = new Map<string, AcceptedGroup>();
    for (const o of sorted) {
      const k = `${o.pickUpDate}::${o.shift}`;
      if (!map.has(k)) {
        map.set(k, { key: k, pickUpDate: o.pickUpDate, shift: o.shift as Shift, items: [] });
      }
      const g = map.get(k)!;

      const ik = `${o.type}::${o.variety}`;
      let item = g.items.find((it) => it.id === ik);

      const hasFinal = typeof o.finalQuantityKg === "number" && Number.isFinite(o.finalQuantityKg);
      const effective = hasFinal ? (o.finalQuantityKg as number) : o.forcastedQuantityKg;

      if (!item) {
        item = {
          id: ik,
          type: o.type,
          variety: o.variety,
          quantityKg: 0,
          forcastedQuantityKg: 0,
          finalQuantityKg: null,
        };
        g.items.push(item);
      }

      item.quantityKg += effective;
      if (hasFinal) item.finalQuantityKg = (item.finalQuantityKg ?? 0) + effective;
      else item.forcastedQuantityKg += o.forcastedQuantityKg;
    }

    for (const g of map.values()) {
      for (const it of g.items) {
        if (typeof it.finalQuantityKg === "number" && Number.isFinite(it.finalQuantityKg)) {
          it.finalQuantityKg = it.quantityKg;
        } else {
          it.finalQuantityKg = null;
          it.forcastedQuantityKg = it.quantityKg;
        }
      }
      g.items.sort((a, b) => {
        const ta = `${a.type} ${a.variety}`.toLowerCase();
        const tb = `${b.type} ${b.variety}`.toLowerCase();
        return ta < tb ? -1 : ta > tb ? 1 : 0;
      });
    }

    return Array.from(map.values());
  }, [query.data]);

  return {
    groups,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
