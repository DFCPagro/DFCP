import { useEffect, useMemo, useState } from "react";
//import RequireAuth from "@/guards/AuthGuard";
import LocationPicker from "@/components/ui/LocationPicker";
import ShiftPicker from "@/components/ui/ShiftPicker";
import ItemCard from "@/components/feature/market/ItemCard";
import { fetchMarket } from "@/api/market";
import type { MarketItem, ShiftCode } from "@/types/market";

export default function Market() {
  const [locationId, setLocationId] = useState<string>();
  const [shift, setShift] = useState<ShiftCode>();
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch market only when both are selected
  useEffect(() => {
    if (!locationId || !shift) { setItems([]); return; }
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchMarket({ locationId, shift });
        if (mounted) setItems(res);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [locationId, shift]);

  const emptyState = useMemo(() => {
    if (!locationId) return "Pick your delivery location to continue.";
    if (!shift) return "Choose a shift to load available items.";
    if (!loading && items.length === 0) return "No items available for this shift.";
    return null;
  }, [locationId, shift, loading, items.length]);

  function handleAddToCart(itemId: string, qty: number) {
    // TODO: integrate your existing cart store/API.
    // Reserve call would include { locationId, shift }
    console.log("ADD", { itemId, qty, locationId, shift });
    alert("Added to cart (mock).");
  }

  function openAddLocationModal() {
    // TODO: show modal / route to /profile/locations/new
    alert("Open add-location modal (mock).");
  }

  return (
   // <RequireAuth>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-4">Market</h1>

        {/* Controls */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <LocationPicker
            value={locationId}
            onChange={setLocationId}
            onAddNew={openAddLocationModal}
          />
          <ShiftPicker
            locationId={locationId}
            value={shift}
            onChange={setShift}
          />
        </div>

        {/* Items */}
        {emptyState ? (
          <div className="p-8 text-center text-gray-600 border rounded-lg">{emptyState}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(it => (
              <ItemCard key={it._id} item={it} onAdd={handleAddToCart} />
            ))}
          </div>
        )}
      </div>
   // </RequireAuth>
  );
}
