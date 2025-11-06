// src/utils/googleMaps.ts
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { GOOGLE_MAPS_API_KEY } from "../helpers/env";

/**
 * This file is safe to call from client code.
 * - It loads Maps + (optionally) Places.
 * - `ensureMarkerLibrary()` best-effort loads the 'marker' library (AdvancedMarkerElement).
 * - All paths are defensive: failures fall back to classic markers without throwing.
 */

let optionsSet = false;
let mapsReady: Promise<typeof google> | null = null;
let markerReady: Promise<void> | null = null;

/** Configure the v2 loader once. */
function ensureOptions() {
  if (optionsSet) return;

  // Do NOT throw in production: throwing during Maps boot can surface Google's banner.
  if (!GOOGLE_MAPS_API_KEY && process.env.NODE_ENV !== "production") {
    console.warn("[googleMaps] GOOGLE_MAPS_API_KEY missing; check env and referrer restrictions");
  }

  setOptions({

    // v2 loader expects `key`, not `apiKey`
    key: GOOGLE_MAPS_API_KEY || "",
    v: "weekly",
    language: "en",
    region: "US",
  });
  optionsSet = true;
}

/**
 * Load Maps + Places and return the global `google` object (typed).
 * Places is optional — if it fails (disabled in project), we still resolve Maps.
 */
export function loadGoogleMaps(): Promise<typeof google> {
  if (mapsReady) return mapsReady;
  ensureOptions();

  mapsReady = Promise.all([
    importLibrary("maps"),
    // Places is used by AddressAutocomplete; catch so we don't fail Maps if Places isn't enabled
    importLibrary("places").catch(() => undefined),
  ]).then(() => (window as any).google as typeof google);

  return mapsReady;
}

/**
 * Best-effort load of the 'marker' library for AdvancedMarkerElement + PinElement.
 * This NEVER throws — if it fails, callers should fall back to classic markers.
 */
export async function ensureMarkerLibrary(): Promise<void> {
  if (markerReady) return markerReady;

  markerReady = (async () => {
    try {
      const g = await loadGoogleMaps();
      // If already present, nothing to do
      if ((g.maps as any).marker?.AdvancedMarkerElement && (g.maps as any).marker?.PinElement) return;
      await importLibrary("marker"); // v2: dynamically loads the library
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[googleMaps] 'marker' library unavailable; using classic markers", e);
      }
    }
  })();

  return markerReady;
}

/** Convenience: create a Map instance after Maps is ready. */
export async function createMap(
  el: HTMLElement,
  opts: google.maps.MapOptions
): Promise<google.maps.Map> {
  const g = await loadGoogleMaps();
  return new g.maps.Map(el, opts);
}

/** Reverse-geocode lat/lng → formatted address (empty string if not found). */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const g = await loadGoogleMaps();
  try {
    const geocoder = new g.maps.Geocoder();
    const { results } = await geocoder.geocode({ location: { lat, lng } });
    return results?.[0]?.formatted_address ?? "";
  } catch {
    return "";
  }
}

/** Geocode an address → { lat, lng } | null. */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const g = await loadGoogleMaps();
  try {
    const geocoder = new g.maps.Geocoder();
    const { results } = await geocoder.geocode({ address });
    const loc = results?.[0]?.geometry?.location;
    if (!loc) return null;
    return { lat: loc.lat(), lng: loc.lng() };
  } catch {
    return null;
  }
}

/** Quick utility: detect if Advanced Markers are currently available (after ensureMarkerLibrary). */
export function hasAdvancedMarkers(): boolean {
  const g = (window as any).google as typeof google | undefined;
  return !!g?.maps?.marker?.AdvancedMarkerElement && !!(g?.maps as any)?.marker?.PinElement;
}
