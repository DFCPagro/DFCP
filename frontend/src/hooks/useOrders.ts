import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData, // ✅ v5 helper
} from "@tanstack/react-query";
import { fetchOrders, mintQrs } from "@/api/orders";
import { useOrdersStore } from "@/store/orders";
import type { PaginatedOrders } from "@/types/orders";

export function useOrders(page = 1, pageSize = 20) {
  return useQuery<PaginatedOrders, Error, PaginatedOrders, ["orders", number, number]>({
    queryKey: ["orders", page, pageSize] as const,
    queryFn: () => fetchOrders(page, pageSize),
    placeholderData: keepPreviousData, // ✅ replaces keepPreviousData option in v5
  });
}

export function useMintQrs() {
  const setTokens = useOrdersStore((s) => s.setTokens);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ttlDays }: { id: string; ttlDays?: number }) =>
      mintQrs(id, ttlDays),
    onSuccess: (data, variables) => {
      setTokens(variables.id, data);
      // optional: if minting should reflect in list, invalidate
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
