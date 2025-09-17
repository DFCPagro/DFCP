import { useEffect, useState } from "react";
import { useCart } from "@/store/cart";
import { onCartUpdated } from "@/utils/cart";

const KEY = "dfcp_cart_v1";

/** Prefer zustand items; if empty, mirror localStorage items (and keep in sync). */
export function useCartItemsUnified() {
  const store = useCart();
  const storeItems = store?.state?.items ?? [];
  const [lsItems, setLsItems] = useState<any[]>([]);

  useEffect(() => {
    const read = () => {
      try {
        const bag = JSON.parse(localStorage.getItem(KEY) || "{}");
        setLsItems(Array.isArray(bag.items) ? bag.items : []);
      } catch {
        setLsItems([]);
      }
    };
    read();

    // Keep local mirror hot
    const off = onCartUpdated(read);
    const onStorage = () => read(); // cross-tab
    window.addEventListener("storage", onStorage);
    return () => {
      off();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return storeItems.length ? storeItems : lsItems;
}
