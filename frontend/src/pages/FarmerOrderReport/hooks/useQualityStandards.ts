// src/hooks/useFarmerOrders.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  qkFarmerOrdersByShift,
  getFarmerOrdersByShift,
  getMyFarmerOrdersByShift,
  getFarmerOrdersSummary,
  advanceFarmerOrderStage,
  updateFarmerOrderStatus,
  getFarmerOrderPrintPayload,
  initContainers,
  patchContainerWeights,
} from "@/api/farmerOrders";

export function useFarmerOrdersSummary() {
  return useQuery({
    queryKey: ["farmerOrders", "summary"],
    queryFn: getFarmerOrdersSummary,
  });
}

export function useOrdersByShift(params: Parameters<typeof qkFarmerOrdersByShift>[0]) {
  return useQuery({
    queryKey: qkFarmerOrdersByShift(params),
    queryFn: () => getFarmerOrdersByShift(params),
    enabled: Boolean(params?.date && params?.shiftName),
  });
}

export function useMyOrdersByShift(params: Parameters<typeof qkFarmerOrdersByShift>[0]) {
  return useQuery({
    queryKey: qkFarmerOrdersByShift(params),
    queryFn: () => getMyFarmerOrdersByShift(params),
    enabled: Boolean(params?.date && params?.shiftName),
  });
}

export function useAdvanceStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof advanceFarmerOrderStage>[1] }) =>
      advanceFarmerOrderStage(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmerOrders"] });
    },
  });
}

export function useUpdateFarmerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: any; note?: string }) =>
      updateFarmerOrderStatus(id, status, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmerOrders"] });
    },
  });
}

export function usePrintPayload(farmerOrderId?: string) {
  return useQuery({
    queryKey: ["farmerOrders", "print", farmerOrderId],
    queryFn: () => getFarmerOrderPrintPayload(farmerOrderId!),
    enabled: !!farmerOrderId,
  });
}

export function useInitContainers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, count }: { id: string; count: number }) => initContainers(id, count),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["farmerOrders", "print", id] });
    },
  });
}

export function usePatchContainerWeights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, weights }: { id: string; weights: Array<{ containerId: string; weightKg: number }> }) =>
      patchContainerWeights(id, weights),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["farmerOrders", "print", id] });
    },
  });
}
