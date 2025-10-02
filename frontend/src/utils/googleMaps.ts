import { Loader } from "@googlemaps/js-api-loader";
import { GOOGLE_MAPS_API_KEY } from "../helpers/env";

let mapsPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (!mapsPromise) {
    if (!GOOGLE_MAPS_API_KEY) throw new Error("VITE_GOOGLE_MAPS_API_KEY is missing");

    const loader = new Loader({
      apiKey: GOOGLE_MAPS_API_KEY,
      version: "weekly",
      language: "en",
      region: "US",
    });

    mapsPromise = (async () => {
      await loader.importLibrary("maps");
      // load Places if other parts need it; ignore if not installed
      try { await loader.importLibrary("places"); } catch {}
      return (window as any).google as typeof google;
    })();
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
