import { useQuery } from "@tanstack/react-query";
import { getOrdersForShift } from "@/api/orders";
import type { CSOrdersResponse, OrderStatus } from "@/types/cs.orders";

type Params = {
  
  date: string;
  shiftName: string;
  // kept for caller compatibility; not sent to API
  status?: OrderStatus;
  // preferred param name; sent to API
  stageKey?: OrderStatus;
  page?: number;
  limit?: number;
  fields?: string[];
};

export function useCSOrdersForShift(params: Params) {
  const {
    
    date,
    shiftName,
    status,
    stageKey,
    page,
    limit,
    fields,
  } = params;

  // normalize to a single stage value
  const stage: OrderStatus | undefined = stageKey ?? status;

  return useQuery<CSOrdersResponse>({
    queryKey: [
      "csOrdersByShift",
     
      date,
      shiftName,
      stage ?? "",
      page ?? "",
      limit ?? "",
      JSON.stringify(fields ?? []),
    ],
    // send only supported keys to the API
    queryFn: () =>
      getOrdersForShift({
      
        date,
        shiftName,
        stageKey: stage,
        page,
        limit,
        fields,
      }),
    enabled: Boolean(date && shiftName),
    // client-side fallback if server did not filter
    select: (resp) => {
      if (!stage) return resp;
      const getStage = (i: any): OrderStatus | undefined =>
        (i?.stageKey as OrderStatus | undefined) ??
        (i?.status as OrderStatus | undefined);

      const needsFilter = resp.items.some((i) => getStage(i) !== stage);
      return needsFilter
        ? { ...resp, items: resp.items.filter((i) => getStage(i) === stage) }
        : resp;
    },
    staleTime: 30_000,
  });
}
