// src/pages/csManager/shiftOrders/hooks/useCSOrdersForShift.ts
import { useQuery } from "@tanstack/react-query";
import { getOrdersForShift } from "@/api/orders";
import type { CSOrdersResponse, OrderStatus } from "@/types/cs.orders";

type Params = {
  logisticCenterId: string;
  date: string;
  shiftName: string;
  status?: OrderStatus;   // <- keep this
  page?: number;
  limit?: number;
  fields?: string[];
};

export function useCSOrdersForShift(params: Params) {
  const { logisticCenterId, date, shiftName, status, page, limit, fields } = params;

  return useQuery<CSOrdersResponse>({
    queryKey: [
      "csOrdersByShift",
      logisticCenterId,
      date,
      shiftName,
      status ?? "",
      page ?? "",
      limit ?? "",
      JSON.stringify(fields ?? []),
    ],
    queryFn: () => getOrdersForShift({ logisticCenterId, date, shiftName, status, page, limit, fields }),
    enabled: Boolean(logisticCenterId && date && shiftName),

    // Client-side fallback: if server didn't filter by status, do it here.
    select: (resp) => {
      if (!status) return resp;
      // If items include different statuses, narrow to requested status
      const needsFilter = resp.items.some(i => i.status !== status);
      if (!needsFilter) return resp;
      return { ...resp, items: resp.items.filter(i => i.status === status) };
    },
  });
}
