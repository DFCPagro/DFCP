/**
 * Ensure we always send the backend’s required address shape.
 * Backend expects: { lnt, alt, address }
 */
export function buildBackendAddress(input: {
  address?: string;
  latitude?: number;
  longitude?: number;
}) {
  const { address, latitude, longitude } = input;

  if (!address?.trim()) throw new Error("Address is required");
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw new Error("Latitude/longitude are required");
  }

  return {
    lnt: longitude, // backend calls it "lnt"
    alt: latitude,  // backend calls it "alt"
    address: address.trim(),
  };
}
