// src/api/packing.ts
// Minimal API wrapper for starting a packing flow from an order.
// Adjust the URL/path/body to your backend route if different.

export type PackOrderResponse = {
  ok: boolean;
  message?: string;
  packageId?: string;     // if your backend returns a package/container id
  packingSessionId?: string;
  data?: any;
};

export async function packOrder(orderId: string): Promise<PackOrderResponse> {
  if (!orderId) throw new Error("Missing orderId");

  const res = await fetch(`/api/packing/pack-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId }),
    credentials: "include",
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(errText || `packOrder failed with ${res.status}`);
  }

  const json = (await res.json()) as PackOrderResponse | { data?: any; message?: string };
  // Flexible unwrap
  const out: PackOrderResponse = {
    ok: true,
    ...(json as any),
    ...(json as any).data ? (json as any).data : {},
  };
  return out;
}
