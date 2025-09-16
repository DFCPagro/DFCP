import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type { CartItem, CartState, ShiftKey } from "@/types/cart";

const LS_KEY = "dfcp_cart_v1";

const initialState: CartState = { items: [], lcId: null, shiftKey: null };

function reviveState(raw: string | null): CartState {
  if (!raw) return initialState;
  try {
    const parsed = JSON.parse(raw);
    parsed.items = Array.isArray(parsed.items) ? parsed.items : [];
    return parsed as CartState;
  } catch {
    return initialState;
  }
}

type Action =
  | { type: "INIT"; payload: CartState }
  | { type: "SET_LOCK"; lcId: string | null; shiftKey: ShiftKey | null }
  | { type: "ADD_OR_INC"; item: Omit<CartItem, "qtyKg">; deltaKg: number }
  | { type: "UPDATE_QTY"; id: string; qtyKg: number }
  | { type: "REMOVE"; id: string }
  | { type: "PURGE_EXPIRED" }
  | { type: "CLEAR" };

function cartReducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case "INIT":
      return action.payload;
    case "SET_LOCK":
      return { ...state, lcId: action.lcId, shiftKey: action.shiftKey };
    case "ADD_OR_INC": {
      const idx = state.items.findIndex((it) => it.id === action.item.id);
      if (idx >= 0) {
        const items = state.items.slice();
        items[idx] = {
          ...items[idx],
          qtyKg: items[idx].qtyKg + action.deltaKg,
          holdExpiresAt: action.item.holdExpiresAt,
          holdId: action.item.holdId,
        };
        return { ...state, items };
      }
      const newItem: CartItem = { ...(action.item as CartItem), qtyKg: action.deltaKg };
      return { ...state, items: [...state.items, newItem] };
    }
    case "UPDATE_QTY": {
      const items = state.items.map((it) =>
        it.id === action.id ? { ...it, qtyKg: action.qtyKg } : it
      );
      return { ...state, items };
    }
    case "REMOVE":
      return { ...state, items: state.items.filter((it) => it.id !== action.id) };
    case "PURGE_EXPIRED": {
      const now = Date.now();
      return { ...state, items: state.items.filter((it) => it.holdExpiresAt > now) };
    }
    case "CLEAR":
      return { ...state, items: [] };
    default:
      return state;
  }
}

interface CartApi {
  state: CartState;
  totals: { totalItemsKg: number; totalPrice: number };
  setLock: (lcId: string | null, shiftKey: ShiftKey | null) => void;
  addOrInc: (item: Omit<CartItem, "qtyKg">, deltaKg?: number) => void;
  updateQty: (id: string, qtyKg: number) => void;
  remove: (id: string) => void;
  purgeExpired: () => void;
  clear: () => void;
}

const CartContext = createContext<CartApi | null>(null);

export const CartProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    dispatch({ type: "INIT", payload: reviveState(localStorage.getItem(LS_KEY)) });
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [state]);

  const totals = useMemo(() => {
    const totalItemsKg = state.items.reduce((acc, it) => acc + it.qtyKg, 0);
    const totalPrice = state.items.reduce(
      (acc, it) => acc + it.qtyKg * it.pricePerKg,
      0
    );
    return { totalItemsKg, totalPrice };
  }, [state.items]);

  const api: CartApi = useMemo(
    () => ({
      state,
      totals,
      setLock: (lcId, shiftKey) => dispatch({ type: "SET_LOCK", lcId, shiftKey }),
      addOrInc: (item, deltaKg = 1) =>
        dispatch({ type: "ADD_OR_INC", item, deltaKg }),
      updateQty: (id, qtyKg) =>
        qtyKg <= 0
          ? dispatch({ type: "REMOVE", id })
          : dispatch({ type: "UPDATE_QTY", id, qtyKg }),
      remove: (id) => dispatch({ type: "REMOVE", id }),
      purgeExpired: () => dispatch({ type: "PURGE_EXPIRED" }),
      clear: () => dispatch({ type: "CLEAR" }),
    }),
    [state, totals]
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
};

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
