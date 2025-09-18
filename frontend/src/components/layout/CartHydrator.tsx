import { useEffect, useRef } from "react";
import { useCart } from "@/store/cart";
import { getCartMeta, getCart } from "@/utils/cart";
import type { ShiftKey } from "@/types/cart";

export default function CartHydrator() {
  const cart = useCart();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    try {
      // 1) lock (lc + shift)
      const meta = getCartMeta();
      const shiftKey = (meta?.shiftKey ?? null) as ShiftKey | null;
      const lc = (meta?.logisticCenterId ?? null) as string | null;
      cart.setLock(lc, shiftKey);

      // 2) items
      const lines = getCart(); // [{ inventoryId, name, price, imageUrl, qty, ... }]
      for (const line of lines) {
        cart.addOrInc(
          {
            id: line.inventoryId,
            name: line.name,
            imageUrl: line.imageUrl,
            pricePerKg: Number(line.price ?? 0),
            farmerName: line.farmer?.name ?? line.farmer?.farmName ?? "",
            // optional fields supported by your store:
            lcId: lc ?? undefined,
            shiftKey: shiftKey ?? undefined,
            holdId: undefined,
            holdExpiresAt: Date.now() + 60_000, // a short placeholder; your store handles expiry purge
          },
          Number(line.qty ?? 1)
        );
      }
    } catch {
      // ignore hydration issues
    }
  }, [cart]);

  return null;
}
