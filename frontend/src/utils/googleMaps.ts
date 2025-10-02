// src/utils/googleMaps.ts
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { GOOGLE_MAPS_API_KEY } from "../helpers/env";

let optionsSet = false;
let ready: Promise<typeof google> | null = null;

function ensureOptions() {
  if (optionsSet) return;
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is missing (check env)");
  }
  setOptions({
    key: GOOGLE_MAPS_API_KEY, // v2: "key" (not "apiKey")
    v: "weekly",
    language: "en",
    region: "US",
  });
  optionsSet = true;
}

/** Load Maps + Places and return the global `google` (typed). */
export function loadGoogleMaps(): Promise<typeof google> {
  if (ready) return ready;
  ensureOptions();
  ready = Promise.all([
    importLibrary("maps"),
    importLibrary("places").catch(() => undefined), // safe if Places not enabled
  ]).then(() => (window as any).google as typeof google);
  return ready;
}

export async function createMap(
  el: HTMLElement,
  opts: google.maps.MapOptions
): Promise<google.maps.Map> {
  const g = await loadGoogleMaps();
  return new g.maps.Map(el, opts);
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
