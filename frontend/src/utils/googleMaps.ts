// src/utils/googleMaps.ts
import { Loader } from "@googlemaps/js-api-loader";
import { GOOGLE_MAPS_API_KEY } from "@/helpers/env";

let mapsPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (!mapsPromise) {
    if (!GOOGLE_MAPS_API_KEY) throw new Error("VITE_GOOGLE_MAPS_API_KEY is missing");

    const loader = new Loader({
      apiKey: GOOGLE_MAPS_API_KEY,
      version: "weekly",
      libraries: ["places"], // base Maps is implicit
      language: "en",
      region: "US",
    });

    mapsPromise = loader.load(); // returns the google namespace
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
