import { useQuery } from "@tanstack/react-query";
import { getOrdersForShift } from "@/api/orders";
import type { CSOrdersResponse } from "@/types/cs.orders";

type Params = {
  logisticCenterId: string;
  date: string;
  shiftName: string;
  status?: string;      // <-- added
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
    queryFn: () => getOrdersForShift(params), // forwards status too
    enabled: Boolean(logisticCenterId && date && shiftName),
  });
}
