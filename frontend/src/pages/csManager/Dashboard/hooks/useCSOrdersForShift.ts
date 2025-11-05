import { useQuery } from "@tanstack/react-query";
import { getOrdersForShift } from "@/api/orders";
import type { CSOrdersResponse } from "@/types/cs.orders";

export function useCSOrdersForShift({
 
  date,
  shiftName,
}: {
  logisticCenterId: string;
  date: string;
  shiftName: string;
}) {
  return useQuery<CSOrdersResponse>({
    queryKey: ["csOrdersByShift", date, shiftName],
    queryFn: () => getOrdersForShift({ date, shiftName }),
    enabled: !!( date && shiftName),
  });
}
