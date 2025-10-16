// src/pages/csManagerOrders/hooks/useCSCurrentOrders.ts
import { useMemo } from "react";

// quick random helpers
const ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = <T,>(arr: readonly T[]) => arr[ri(0, arr.length - 1)];

const STATUSES = ["pending", "ok", "problem"] as const;

export function useCSCurrentOrders({ limit = 20 }: { limit?: number } = {}) {
  const orders = useMemo(() => {
    const now = Date.now();
    return Array.from({ length: limit }).map((_, i) => ({
      id: `cur_${now}_${i}`,
      orderId: `${ri(100000, 999999)}`,
      status: pick(STATUSES),
      createdAt: new Date(now - ri(0, 90) * 60_000).toISOString(),
    }));
  }, [limit]);

  return { orders, isLoading: false };
}
