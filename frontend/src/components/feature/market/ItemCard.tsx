import { useState } from "react";
import type { MarketItem } from "@/types/market";

type Props = {
  item: MarketItem;
  onAdd: (itemId: string, qty: number) => void;
};

export default function ItemCard({ item, onAdd }: Props) {
  const [qty, setQty] = useState(1);
  const canInc = qty < item.inStock;
  const canDec = qty > 1;

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="aspect-square bg-gray-100">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : null}
      </div>

      <div className="p-4 grid gap-2">
        <div className="text-lg font-semibold">{item.name}</div>
        <div className="text-sm text-gray-600">
          {item.farmer.farmName} by {item.farmer.name}
        </div>
        <div className="font-medium">Price: {item.price.toFixed(2)} ₪</div>

        <div className="flex items-center gap-2">
          <span className="text-sm">Quantity:</span>
          <button className="border rounded px-2" onClick={() => setQty(q => Math.max(1, q - 1))} disabled={!canDec}>-</button>
          <span className="min-w-[2ch] text-center">{qty}</span>
          <button className="border rounded px-2" onClick={() => setQty(q => Math.min(item.inStock, q + 1))} disabled={!canInc}>+</button>
        </div>

        <div className="text-sm text-gray-600">inStock: {item.inStock}</div>

        <button
          className="mt-2 bg-black text-white rounded-lg py-2 disabled:opacity-50"
          onClick={() => onAdd(item._id, qty)}
          disabled={item.inStock === 0}
        >
          Add to cart
        </button>
      </div>
    </div>
  );
}
