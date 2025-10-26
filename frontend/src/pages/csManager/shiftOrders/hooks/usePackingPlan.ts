import { useMutation } from "@tanstack/react-query";
import { packOrder } from "@/api/packing";
import type { PackingPlan } from "@/types/packing";

export function usePackingPlan() {
  return useMutation<PackingPlan, Error, { orderId: string }>({
    mutationKey: ["packOrder"],
    mutationFn: async ({ orderId }) => packOrder(orderId),
  });
}
