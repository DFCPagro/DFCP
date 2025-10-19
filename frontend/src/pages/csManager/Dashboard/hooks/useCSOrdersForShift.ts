import { useQuery } from "@tanstack/react-query";
import { getOrdersForShift } from "@/api/orders";
import type { CSOrdersResponse } from "@/types/cs.orders";

export function useCSOrdersForShift({
  logisticCenterId,
  date,
  shiftName,
}: {
  logisticCenterId: string;
  date: string;
  shiftName: string;
}) {
  return useQuery<CSOrdersResponse>({
    queryKey: ["csOrdersByShift", logisticCenterId, date, shiftName],
    queryFn: () => getOrdersForShift({ logisticCenterId, date, shiftName }),
    enabled: !!(logisticCenterId && date && shiftName),
  });
}
