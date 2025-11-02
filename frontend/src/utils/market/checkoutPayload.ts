import type { CartLine } from "@/utils/market/marketCart.shared";
import type { CreateOrderItemInput } from "@/types/orders";

/**
 * Convert one cart line (frontend) into one CreateOrderItemInput (backend).
 */
export function cartLineToCreateOrderItemInput(line: CartLine): CreateOrderItemInput {
  const mode = line.unitMode === "unit" || line.unitMode === "mixed" || line.unitMode === "kg"
    ? line.unitMode
    : "kg";

  const qtyUnits = Number(line.quantity) || 0; // in UI this is "how many boxes/cartons"
  const perUnitKg =
    typeof line.avgWeightPerUnitKg === "number" && line.avgWeightPerUnitKg > 0
      ? line.avgWeightPerUnitKg
      : undefined;

  // base snapshot shared for all modes
  const base: Omit<CreateOrderItemInput, "unitMode"> & { unitMode: any } = {
    itemId: line.itemId,
    farmerOrderId: line.farmerOrderId ?? undefined,
    sourceFarmerName: line.farmerName ?? line.sourceFarmerName ?? "Unknown Farmer",
    sourceFarmName: line.farmName ?? line.sourceFarmName ?? "Unknown Farm",

    name: line.name,
    imageUrl: line.imageUrl,
    category: line.category,

    // IMPORTANT:
    // On the cart we store pricePerUnit as "the thing the user sees".
    // For unit-mode items, that's usually 'price per box/carton'.
    // For kg-mode items, it's 'price per kg'.
    pricePerUnit: Number(line.pricePerUnit) || 0,

    unitMode: mode,
  };

  // fill mode-specific fields
  if (mode === "unit") {
    // Customer is buying <qtyUnits> cartons/boxes/etc.
    return {
      ...base,
      unitMode: "unit",
      units: qtyUnits,         // <-- THIS is what backend Zod wants for "unit"
      quantityKg: 0,           // be explicit so we don't rely on default
      estimatesSnapshot: perUnitKg
        ? { avgWeightPerUnitKg: perUnitKg }
        : undefined,
    };
  }

  if (mode === "kg") {
    // Here, line.quantity is in kg.
    return {
      ...base,
      unitMode: "kg",
      quantityKg: qtyUnits, // here quantity *is* kg
      units: 0,
      // no need to send estimatesSnapshot for pure kg
    };
  }

  // fallback / "mixed" mode:
  // assume quantity means "units", because that's how UI behaves today.
  // you can extend this later to carry both units+kg if you add that UX.
  return {
    ...base,
    unitMode: "mixed",
    units: qtyUnits,
    quantityKg: 0,
    estimatesSnapshot: perUnitKg
      ? { avgWeightPerUnitKg: perUnitKg }
      : undefined,
  };
}
