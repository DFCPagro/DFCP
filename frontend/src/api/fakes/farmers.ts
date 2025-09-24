// src/api/fake/farmers.ts
export const FAKE_FARMERS: Array<{ id: string; name: string }> = [
  { id: "FAR-01", name: "Green Valley Farm" },
  { id: "FAR-02", name: "Sunridge Fields" },
  { id: "FAR-03", name: "North Grove" },
  { id: "FAR-04", name: "Hillcrest Patch" },
  { id: "FAR-05", name: "East Orchard" },
  { id: "FAR-06", name: "Riverside Farm" },
];

export function farmerNameById(id?: string | null): string {
  if (!id) return "—";
  return FAKE_FARMERS.find((f) => f.id === id)?.name ?? id;
}
