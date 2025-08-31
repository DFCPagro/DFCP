import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OrderTokens = {
  opsUrl: string;
  customerUrl: string;
  opsToken: string;
  customerToken: string;
};

type OrdersState = {
  tokens: Record<string, OrderTokens>;
  setTokens: (orderId: string, t: OrderTokens) => void;
  getTokens: (orderId: string) => OrderTokens | undefined;
  clearTokens: (orderId: string) => void;
  clearAll: () => void;
};

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set, get) => ({
      tokens: {},
      setTokens: (orderId, t) =>
        set((s) => ({ tokens: { ...s.tokens, [orderId]: t } })),
      getTokens: (orderId) => get().tokens[orderId],
      clearTokens: (orderId) =>
        set((s) => {
          const { [orderId]: _, ...rest } = s.tokens;
          return { tokens: rest };
        }),
      clearAll: () => set({ tokens: {} }),
    }),
    { name: "orders" }
  )
);
