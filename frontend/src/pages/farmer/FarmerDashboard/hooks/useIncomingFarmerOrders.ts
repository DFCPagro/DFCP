import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listMyOrders,
  acceptMyFarmerOrder,
  rejectMyFarmerOrder,
  qkMyOrdersPending,
  qkMyOrdersAccepted,
  FARMER_ORDER_CARD_FIELDS,
} from "@/api/farmerOrders";
import type { FarmerOrderDTO } from "@/types/farmerOrders";

export type UseIncomingParams = {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  enabled?: boolean;
};

export function useIncomingFarmerOrders(params?: UseIncomingParams) {
  const { from, to, enabled = true } = params ?? {};
  const qc = useQueryClient();

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: qkMyOrdersPending({ from, to }),
    queryFn: async () =>
      listMyOrders({
        farmerStatus: "pending",
        from,
        to,
        window: from || to ? "all" : "future",
        fields: FARMER_ORDER_CARD_FIELDS as unknown as string[],
        limit: 200,
      }),
    staleTime: 15_000,
    enabled,
  });

  const acceptMutation = useMutation({
    mutationFn: async (orderId: string) => acceptMyFarmerOrder(orderId),
    onMutate: async (orderId) => {
      setAcceptingId(orderId);
      await Promise.all([
        qc.cancelQueries({ queryKey: qkMyOrdersPending({ from, to }) }),
        qc.cancelQueries({ queryKey: qkMyOrdersAccepted() }),
      ]);

      const prevPending =
        qc.getQueryData<FarmerOrderDTO[]>(qkMyOrdersPending({ from, to })) ?? [];
      const prevAccepted =
        qc.getQueryData<FarmerOrderDTO[]>(qkMyOrdersAccepted()) ?? [];

      const moved = prevPending.find((o) => o.id === orderId);
      if (moved) {
        qc.setQueryData<FarmerOrderDTO[]>(
          qkMyOrdersPending({ from, to }),
          prevPending.filter((o) => o.id !== orderId)
        );
        const dedup = new Map(prevAccepted.map((o) => [o.id, o]));
        dedup.set(orderId, { ...moved, farmerStatus: "ok" });
        qc.setQueryData<FarmerOrderDTO[]>(qkMyOrdersAccepted(), [...dedup.values()]);
      }
      return { prevPending, prevAccepted };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prevPending)
        qc.setQueryData(qkMyOrdersPending({ from, to }), ctx.prevPending);
      if (ctx?.prevAccepted)
        qc.setQueryData(qkMyOrdersAccepted(), ctx.prevAccepted);
    },
    onSettled: async () => {
      setAcceptingId(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: qkMyOrdersPending({ from, to }) }),
        qc.invalidateQueries({ queryKey: qkMyOrdersAccepted() }),
      ]);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (vars: { orderId: string; note: string }) =>
      rejectMyFarmerOrder(vars.orderId, vars.note),
    onMutate: async ({ orderId }) => {
      setRejectingId(orderId);
      await qc.cancelQueries({ queryKey: qkMyOrdersPending({ from, to }) });
      const prevPending =
        qc.getQueryData<FarmerOrderDTO[]>(qkMyOrdersPending({ from, to })) ?? [];
      qc.setQueryData<FarmerOrderDTO[]>(
        qkMyOrdersPending({ from, to }),
        prevPending.filter((o) => o.id !== orderId)
      );
      return { prevPending };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prevPending)
        qc.setQueryData(qkMyOrdersPending({ from, to }), ctx.prevPending);
    },
    onSettled: async () => {
      setRejectingId(null);
      await qc.invalidateQueries({ queryKey: qkMyOrdersPending({ from, to }) });
    },
  });

  const orders = useMemo(() => query.data ?? [], [query.data]);

  return {
    orders,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error as Error | null,
    accept: (orderId: string) => acceptMutation.mutate(orderId),
    reject: (orderId: string, note: string) =>
      rejectMutation.mutate({ orderId, note }),
    acceptingId,
    rejectingId,
    isAccepting: acceptMutation.isPending,
    isRejecting: rejectMutation.isPending,
    refetch: query.refetch,
  };
}
