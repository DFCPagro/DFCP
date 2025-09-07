import { Loader } from "@googlemaps/js-api-loader";
import { GOOGLE_MAPS_API_KEY } from "../helpers/env";
let mapsPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps() {
  if (!mapsPromise) {
    const apiKey = GOOGLE_MAPS_API_KEY
    if (!apiKey) throw new Error("VITE_GOOGLE_MAPS_API_KEY is missing");
    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places"],
    });
    mapsPromise = loader.load();
  }
  return mapsPromise;
}

export async function reverseGeocode(lat: number, lng: number) {
  const g = await loadGoogleMaps();
  const geocoder = new g.maps.Geocoder();
  const { results } = await geocoder.geocode({ location: { lat, lng } });
  return results?.[0]?.formatted_address ?? "";
}

export async function geocodeAddress(address: string) {
  const g = await loadGoogleMaps();
  const geocoder = new g.maps.Geocoder();
  const { results } = await geocoder.geocode({ address });
  const loc = results?.[0]?.geometry?.location;
  if (!loc) return null;
  return { lat: loc.lat(), lng: loc.lng() };
}