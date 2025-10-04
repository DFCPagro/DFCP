"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { loadGoogleMaps } from "@/utils/googleMaps";

export type LatLng = { lat: number; lng: number };

export type MapCanvasHandle = {
  setCenter: (pos: LatLng) => void;
  fitToBounds: (points: LatLng[]) => void;

  // Single loose marker (legacy)
  setSingleMarker: (pos: LatLng) => void;
  clearSingleMarker: () => void;

  // Named markers for double-location flows
  setOriginMarker: (pos: LatLng) => void;
  setDestinationMarker: (pos: LatLng) => void;
  clearOriginMarker: () => void;
  clearDestinationMarker: () => void;
  clearAllMarkers: () => void;

  // Route
  showRoute: (opts: {
    origin: LatLng;
    destination: LatLng;
    travelMode?: google.maps.TravelMode;
    avoidTolls?: boolean;
    avoidHighways?: boolean;
    suppressRendererMarkers?: boolean; // default true → keep our markers visible
  }) => Promise<google.maps.DirectionsResult | null>;
  clearRoute: () => void;
};

type Props = {
  initialCenter: LatLng;
  zoom?: number;
  className?: string;
  onMapReady?: (map: google.maps.Map) => void;
  onClick?: (pos: LatLng) => void;
  onMarkerDragEnd?: (pos: LatLng) => void; // applies to the "single" legacy marker only
  // Use MapOptions["gestureHandling"] to stay aligned with Google Maps typings
  gestureHandling?: google.maps.MapOptions["gestureHandling"];
};

const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas(
  {
    initialCenter,
    zoom = 14,
    className,
    onMapReady,
    onClick,
    onMarkerDragEnd,
    gestureHandling = "greedy",
  },
  ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Markers
  const singleMarkerRef = useRef<google.maps.Marker | null>(null);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);

  // Directions
  const dirRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const [ready, setReady] = useState(false);

  // Initialize the map **once** on mount.
  // IMPORTANT: Do NOT depend on props here (like initialCenter/zoom) or the map will be torn down and recreated,
  // wiping markers and routes after user actions.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadGoogleMaps();
      if (cancelled || !hostRef.current) return;

      const g = (window as any).google as typeof google;
      const map = new g.maps.Map(hostRef.current, {
        center: initialCenter,
        zoom,
        gestureHandling,
        streetViewControl: false,
        fullscreenControl: false,
        mapTypeControl: false,
      });
      mapRef.current = map;

      listenersRef.current.push(
        map.addListener("click", (e) => {
          if (!e.latLng || !onClick) return;
          onClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        })
      );

      setReady(true);
      onMapReady?.(map);
    })();

    return () => {
      cancelled = true;
      try {
        listenersRef.current.forEach((l) => l.remove());
        listenersRef.current = [];
        singleMarkerRef.current?.setMap(null);
        singleMarkerRef.current = null;
        originMarkerRef.current?.setMap(null);
        originMarkerRef.current = null;
        destinationMarkerRef.current?.setMap(null);
        destinationMarkerRef.current = null;
        dirRendererRef.current?.setMap(null);
        dirRendererRef.current = null;
        mapRef.current = null;
        if (hostRef.current) hostRef.current.innerHTML = "";
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only

  // --- helpers (no "this" usage) ---
  const ensureOriginMarker = (pos: LatLng) => {
    const g = (window as any).google as typeof google;
    const m = mapRef.current;
    if (!m) return;
    if (!originMarkerRef.current) {
      originMarkerRef.current = new g.maps.Marker({
        map: m,
        position: pos,
        label: "A",
      });
    } else {
      originMarkerRef.current.setPosition(pos);
      originMarkerRef.current.setMap(m);
    }
  };

  const ensureDestinationMarker = (pos: LatLng) => {
    const g = (window as any).google as typeof google;
    const m = mapRef.current;
    if (!m) return;
    if (!destinationMarkerRef.current) {
      destinationMarkerRef.current = new g.maps.Marker({
        map: m,
        position: pos,
        label: "B",
      });
    } else {
      destinationMarkerRef.current.setPosition(pos);
      destinationMarkerRef.current.setMap(m);
    }
  };

  const fitPoints = (points: LatLng[]) => {
    const m = mapRef.current;
    const g = (window as any).google as typeof google;
    if (!m || points.length === 0) return;
    const b = new g.maps.LatLngBounds();
    points.forEach((p) => b.extend(p));
    m.fitBounds(b, 48);
  };

  useImperativeHandle(ref, (): MapCanvasHandle => {
    return {
      setCenter(pos) {
        const m = mapRef.current;
        if (!m) return;
        m.setCenter(pos);
      },

      fitToBounds(points) {
        fitPoints(points);
      },

      // Legacy single marker (kept for backwards compat)
      setSingleMarker(pos) {
        const g = (window as any).google as typeof google;
        const m = mapRef.current;
        if (!m) return;
        // Clear route & named markers so it's obvious this is "single" mode
        dirRendererRef.current?.setMap(null);
        dirRendererRef.current = null;
        originMarkerRef.current?.setMap(null);
        destinationMarkerRef.current?.setMap(null);

        if (!singleMarkerRef.current) {
          singleMarkerRef.current = new g.maps.Marker({
            map: m,
            position: pos,
            draggable: !!onMarkerDragEnd,
          });
          if (onMarkerDragEnd) {
            listenersRef.current.push(
              singleMarkerRef.current.addListener("dragend", () => {
                const p = singleMarkerRef.current!.getPosition();
                if (!p) return;
                onMarkerDragEnd({ lat: p.lat(), lng: p.lng() });
              })
            );
          }
        } else {
          singleMarkerRef.current.setPosition(pos);
          singleMarkerRef.current.setMap(m);
        }
        m.setCenter(pos);
      },
      clearSingleMarker() {
        singleMarkerRef.current?.setMap(null);
      },

      // Named markers for origin/destination
      setOriginMarker(pos) {
        ensureOriginMarker(pos);
      },
      setDestinationMarker(pos) {
        ensureDestinationMarker(pos);
      },
      clearOriginMarker() {
        originMarkerRef.current?.setMap(null);
      },
      clearDestinationMarker() {
        destinationMarkerRef.current?.setMap(null);
      },
      clearAllMarkers() {
        singleMarkerRef.current?.setMap(null);
        originMarkerRef.current?.setMap(null);
        destinationMarkerRef.current?.setMap(null);
      },

      async showRoute({
        origin,
        destination,
        travelMode = google.maps.TravelMode.DRIVING,
        avoidTolls,
        avoidHighways,
        suppressRendererMarkers = true,
      }) {
        const g = (window as any).google as typeof google;
        const m = mapRef.current;
        if (!m) return null;

        // Keep our own A/B markers visible
        ensureOriginMarker(origin);
        ensureDestinationMarker(destination);

        // Single marker shouldn't appear in route mode
        singleMarkerRef.current?.setMap(null);

        const service = new g.maps.DirectionsService();
        const res = await service.route({
          origin,
          destination,
          travelMode,
          drivingOptions:
            travelMode === g.maps.TravelMode.DRIVING
              ? { departureTime: new Date() }
              : undefined,
          avoidTolls,
          avoidHighways,
          provideRouteAlternatives: false,
        });

        if (!dirRendererRef.current) {
          dirRendererRef.current = new g.maps.DirectionsRenderer({
            map: m,
            suppressMarkers: suppressRendererMarkers,
            preserveViewport: true,
            //   preserveViewport: false,
            //   polylineOptions: {
            //     strokeOpacity: 0.9,
            //     strokeWeight: 6, // slightly thicker for visibility
            //   },
          });
        } else {
          dirRendererRef.current.setMap(m);
        }
        dirRendererRef.current.setDirections(res);

        // Fit to route bounds (plus padding). Fallback to endpoints.
        const route = res.routes[0];
        if (route?.bounds) {
          m.fitBounds(route.bounds, 56);
        } else {
          fitPoints([origin, destination]);
        }

        return res;
      },

      clearRoute() {
        dirRendererRef.current?.setMap(null);
        dirRendererRef.current = null;
      },
    };
  }, [onMarkerDragEnd]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ width: "100%", height: "100%", opacity: ready ? 1 : 0.001 }}
    />
  );
});

export default MapCanvas;
