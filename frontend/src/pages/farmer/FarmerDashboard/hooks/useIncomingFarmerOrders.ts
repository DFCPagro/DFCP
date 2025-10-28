// src/pages/FarmerDashboard/hooks/useIncomingFarmerOrders.ts
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import {
//   listFarmerOrders,
//   acceptFarmerOrder as apiAccept,
//   rejectFarmerOrder as apiReject,
// } from "@/api/farmerOrders";
import type { FarmerOrderDTO } from "@/types/farmerOrders";

export type UseIncomingParams = {
  /** Optionally restrict by pickup date range (YYYY-MM-DD, local) */
  from?: string;
  to?: string;
  /** Enable/disable fetching */
  enabled?: boolean;
};

/** Stable query key builders so optimistic updates hit the same caches the Accepted hook uses */
const keyPending = (p?: { from?: string; to?: string }) =>
  ["farmerOrders", { status: "pending", from: p?.from, to: p?.to }] as const;
const keyAccepted = () => ["farmerOrders", { status: "ok" }] as const;

export function useIncomingFarmerOrders(params?: UseIncomingParams) {
  const { from, to, enabled = true } = params ?? {};
  const qc = useQueryClient();

  // Track which order is being accepted/rejected (for UI button disable/spinners)
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  /** Load incoming (pending) orders */
  const query = useQuery({
    queryKey: keyPending({ from, to }),
    // queryFn: () => listFarmerOrders({ farmerStatus: "pending", from, to }),
    staleTime: 15_000,
    enabled,
  });

  /** -------- Accept (optimistic: move from pending -> accepted) -------- */
  const acceptMutation = useMutation({
    // mutationFn: async (orderId: string) => apiAccept(orderId),
    onMutate: async (orderId: string) => {
      setAcceptingId(orderId);
      // cancel to avoid races
      await Promise.all([
        qc.cancelQueries({ queryKey: keyPending({ from, to }) }),
        qc.cancelQueries({ queryKey: keyAccepted() }),
      ]);

      const previousPending =
        qc.getQueryData<FarmerOrderDTO[]>(keyPending({ from, to })) ?? [];
      const previousAccepted =
        qc.getQueryData<FarmerOrderDTO[]>(keyAccepted()) ?? [];

      const moved = previousPending.find((o) => o.id === orderId);

      if (moved) {
        // Remove from pending
        qc.setQueryData<FarmerOrderDTO[]>(
          keyPending({ from, to }),
          previousPending.filter((o) => o.id !== orderId)
        );

        // Add/update in accepted
        const candidate: FarmerOrderDTO = { ...moved, farmerStatus: "ok" };
        const dedup = new Map(previousAccepted.map((o) => [o.id, o]));
        dedup.set(candidate.id, candidate);
        qc.setQueryData<FarmerOrderDTO[]>(
          keyAccepted(),
          Array.from(dedup.values())
        );
      }

      return { previousPending, previousAccepted };
    },
    onError: (_err, _orderId, ctx) => {
      // Rollback
      if (ctx?.previousPending)
        qc.setQueryData(keyPending({ from, to }), ctx.previousPending);
      if (ctx?.previousAccepted)
        qc.setQueryData(keyAccepted(), ctx.previousAccepted);
    },
    onSettled: async () => {
      setAcceptingId(null);
      // Ensure server truth
      await Promise.all([
        qc.invalidateQueries({ queryKey: keyPending({ from, to }) }),
        qc.invalidateQueries({ queryKey: keyAccepted() }),
      ]);
    },
  });

  /** -------- Reject (optimistic: remove from pending) -------- */
  const rejectMutation = useMutation({
    mutationFn: async (payload: { orderId: string; note: string }) => {},
    //   apiReject(payload.orderId, payload.note),
    // onMutate: async ({ orderId }) => {
    //   setRejectingId(orderId);
    //   await qc.cancelQueries({ queryKey: keyPending({ from, to }) });

    //   const previousPending =
    //     qc.getQueryData<FarmerOrderDTO[]>(keyPending({ from, to })) ?? [];

    //   // Optimistically remove from pending
    //   qc.setQueryData<FarmerOrderDTO[]>(
    //     keyPending({ from, to }),
    //     previousPending.filter((o) => o.id !== orderId)
    //   );

    //   return { previousPending };
    // },
    // onError: (_err, _vars, ctx) => {
    //   if (ctx?.previousPending)
    //     qc.setQueryData(keyPending({ from, to }), ctx.previousPending);
    // },
    // onSettled: async () => {
    //   setRejectingId(null);
    //   await qc.invalidateQueries({ queryKey: keyPending({ from, to }) });
    // },
  });

  /** Public API */
  const orders = useMemo(() => query.data ?? [], [query.data]);

  return {
    /** Data */
    orders,

    /** Status flags */
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error as Error | null,

    /** Mutations */
    accept: (orderId: string) => acceptMutation.mutate(orderId),
    reject: (orderId: string, note: string) =>
      rejectMutation.mutate({ orderId, note }),

    /** Button-level loading states */
    acceptingId,
    rejectingId,
    isAccepting: acceptMutation.isPending,
    isRejecting: rejectMutation.isPending,

    /** Refetch (manual) */
    refetch: query.refetch,
  };
}
