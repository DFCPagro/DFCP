import type { ItemRow } from "@/components/common/ItemList";

export function toItemRows(items: any[]): ItemRow[] {
  return (items ?? []).map((it: any, idx: number): ItemRow => ({
    id: it.id ?? it.productId ?? String(idx),
    name: it.name ?? it.displayName ?? it.productName ?? it.productId ?? "item",
    farmer: it.farmerName ?? it.farmer ?? "—",
    imageUrl: it.imageUrl ?? it.image ?? undefined,
    qty: Number(it.quantity ?? it.qty ?? 0),
    unitLabel: it.unit ?? it.unitLabel ?? "unit",
    unitPrice: Number(it.unitPrice ?? it.pricePerUnit ?? it.price ?? 0),
    currency: it.currency ?? undefined,
  }));
}

export function pickCurrency(items: any[]): string | undefined {
  for (const it of items ?? []) if (it?.currency) return it.currency;
  return undefined;
}
