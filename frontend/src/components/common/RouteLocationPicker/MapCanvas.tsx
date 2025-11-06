"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { loadGoogleMaps, ensureMarkerLibrary } from "@/utils/googleMaps";

// NEW: pull in Lucide icons and a way to stringify them for innerHTML
import { Home, Briefcase, Circle as CircleIcon, Flag } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

const USE_ADVANCED_PINS = false;

export type LatLng = { lat: number; lng: number };

export type MapCanvasHandle = {
  setCenter: (pos: LatLng) => void;
  fitToBounds: (points: LatLng[]) => void;

  // Single loose marker (kept for backwards compat)
  setSingleMarker: (pos: LatLng) => void;
  clearSingleMarker: () => void;

  // Named markers for double-location flows (no “A/B” text; custom pins)
  setOriginMarker: (pos: LatLng) => void;
  setDestinationMarker: (pos: LatLng) => void;
  clearOriginMarker: () => void;
  clearDestinationMarker: () => void;
  clearAllMarkers: () => void;

  // Typed “overlay” pins
  setHomeMarker: (pos: LatLng, label?: string) => void;
  clearHomeMarker: () => void;
  setBusinessMarker: (pos: LatLng, label?: string) => void;
  clearBusinessMarker: () => void;

  // Route
  showRoute: (opts: {
    origin: LatLng;
    destination: LatLng;
    travelMode?: google.maps.TravelMode;
    avoidTolls?: boolean;
    avoidHighways?: boolean;
    suppressRendererMarkers?: boolean;
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

  // Directions
  const dirRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  // Classic markers (fallback path)
  const singleMarkerRef = useRef<google.maps.Marker | null>(null);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const homeMarkerClassicRef = useRef<google.maps.Marker | null>(null);
  const businessMarkerClassicRef = useRef<google.maps.Marker | null>(null);

  // Advanced markers (chip+pin)
  const homeMarkerAdvRef = useRef<any | null>(null);
  const businessMarkerAdvRef = useRef<any | null>(null);
  const originAdvRef = useRef<any | null>(null);
  const destinationAdvRef = useRef<any | null>(null);
  const singleAdvRef = useRef<any | null>(null);

  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const [ready, setReady] = useState(false);

  // ---------- helpers: env/UI atoms ------------------------------------------

  const haveAdvancedMarkers = () => {
    const g = (window as any).google as typeof google | undefined;
    return !!g?.maps?.marker?.AdvancedMarkerElement && !!(g.maps as any).marker?.PinElement;
  };

  const prefersDark = () =>
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

  // --- NEW: Lucide glyphs rendered to SVG strings (so we can innerHTML them) --
  const lucide = (el: React.ReactElement) =>
    renderToStaticMarkup(el);

  const HOME_GLYPH = lucide(<Home size={18} stroke="currentColor" strokeWidth={2} />);
  const BRIEFCASE_GLYPH = lucide(<Briefcase size={18} stroke="currentColor" strokeWidth={2} />);
  const ORIGIN_GLYPH = lucide(<CircleIcon size={18} stroke="currentColor" strokeWidth={2} />);
  const DEST_GLYPH = lucide(<Flag size={18} stroke="currentColor" strokeWidth={2} />);

  // Minimal tapered pin + subtle glow
  const pinSVG = (fill: string) =>
    `
<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.6" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <g filter="url(#glow)">
    <path d="M15 2c7 0 12 5.2 12 11.6 0 7.7-8.7 17.2-11.1 20a1.2 1.2 0 0 1-1.8 0C11.7 30.8 3 21.3 3 13.6 3 7.2 8 2 15 2z" fill="${fill}" stroke="#0f172a" stroke-width="1"/>
    <circle cx="15" cy="14" r="4" fill="#fff" />
  </g>
</svg>`.trim();

  const svgToElement = (svg: string) => {
    const div = document.createElement("div");
    div.innerHTML = svg;
    return div.firstChild as HTMLElement;
  };

  // Chip UI (dark/light aware)
  const makeChip = (text: string) => {
    const chip = document.createElement("div");
    const dark = prefersDark();
    chip.style.font = "600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter";
    chip.style.padding = "6px 10px";
    chip.style.borderRadius = "9999px";
    chip.style.boxShadow = dark
      ? "0 4px 16px rgba(0,0,0,0.45)"
      : "0 4px 14px rgba(0,0,0,0.18)";
    chip.style.background = dark ? "rgba(17,24,39,0.92)" : "#ffffff";
    chip.style.color = dark ? "#e5e7eb" : "#111827";
    chip.style.display = "inline-flex";
    chip.style.alignItems = "center";
    chip.style.gap = "8px";
    chip.style.transform = "translateY(-4px)";
    chip.style.backdropFilter = "saturate(120%) blur(6px)";
    chip.style.zIndex = "9999";
    chip.innerHTML = text;
    chip.onmouseenter = () => (chip.style.transform = "translateY(-6px) scale(1.02)");
    chip.onmouseleave = () => (chip.style.transform = "translateY(-4px) scale(1.0)");
    return chip;
  };

  // Stack pin + chip vertically
  const stackPinAndChip = (pin: HTMLElement, chip?: HTMLElement) => {
    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.placeItems = "center";
    wrap.style.pointerEvents = "auto";
    wrap.appendChild(pin);
    if (chip) wrap.appendChild(chip);
    return wrap;
  };

  // Advanced marker content (PinElement + glyph overlay)
  const makeAdvPin = (colorHex: string, glyphSVG: string) => {
    const g = (window as any).google as typeof google;
    const pinEl = new (g.maps as any).marker.PinElement({
      background: colorHex,
      borderColor: prefersDark() ? "#0b1220" : "#0f172a",
      glyphColor: "#ffffff",
      scale: 1.12,
    });
    const holder = document.createElement("div");
    holder.style.position = "relative";
    holder.appendChild(pinEl.element);
    const glyph = document.createElement("div");
    glyph.innerHTML = glyphSVG;
    glyph.style.position = "absolute";
    glyph.style.top = "8px";
    glyph.style.left = "50%";
    glyph.style.transform = "translateX(-50%)";
    glyph.style.color = "#ffffff";
    holder.appendChild(glyph);
    return holder;
  };

  // Classic icon fallback
  const makeClassicIcon = (fill: string): google.maps.Symbol => ({
    path:
      "M15 2c7 0 12 5.2 12 11.6 0 7.7-8.7 17.2-11.1 20a1.2 1.2 0 0 1-1.8 0C11.7 30.8 3 21.3 3 13.6 3 7.2 8 2 15 2z",
    fillColor: fill,
    fillOpacity: 0.98,
    strokeWeight: 1.1,
    strokeColor: "#0f172a",
    scale: 0.8,
    anchor: new google.maps.Point(15, 40),
  });

  // ---------- map init & teardown --------------------------------------------

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadGoogleMaps();
      if (USE_ADVANCED_PINS) {
        try {
          await ensureMarkerLibrary();
        } catch {}
      }

      if (cancelled || !hostRef.current) return;
      const g = (window as any).google as typeof google;

      // sanity: see availability in console
      // eslint-disable-next-line no-console
      console.log(
        "[MapCanvas] advanced markers available?",
        !!(g.maps as any).marker?.AdvancedMarkerElement
      );

      const map = new g.maps.Map(hostRef.current, {
        center: initialCenter,
        zoom,
        gestureHandling,
        streetViewControl: false,
        fullscreenControl: false,
        mapTypeControl: false,
        backgroundColor: prefersDark() ? "#0b1220" : "#f8fafc",
        clickableIcons: false,
      });
      mapRef.current = map;

      listenersRef.current.push(
        map.addListener("click", (e) => {
          if (!e.latLng || !onClick) return;
          onClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        })
      );

      // Styled DirectionsRenderer (PolylineOptions object, not Polyline instance)
      dirRendererRef.current = new g.maps.DirectionsRenderer({
        map,
        suppressMarkers: true, // IMPORTANT: never use default Google markers
        preserveViewport: true,
        polylineOptions: {
          strokeOpacity: 0.9,
          strokeWeight: 6,
          strokeColor: prefersDark() ? "#60a5fa" : "#2563eb",
        } as google.maps.PolylineOptions,
      });

      setReady(true);
      onMapReady?.(map);
    })();

    return () => {
      cancelled = true;
      try {
        listenersRef.current.forEach((l) => l.remove());
        listenersRef.current = [];
        [singleMarkerRef, originMarkerRef, destinationMarkerRef, homeMarkerClassicRef, businessMarkerClassicRef]
          .forEach((r) => r.current?.setMap(null));
        [homeMarkerAdvRef, businessMarkerAdvRef, originAdvRef, destinationAdvRef, singleAdvRef]
          .forEach((r) => { if (r.current) (r.current as any).map = null; });
        dirRendererRef.current?.setMap(null);
        dirRendererRef.current = null;
        mapRef.current = null;
        if (hostRef.current) hostRef.current.innerHTML = "";
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- small utils -----------------------------------------------------

  const fitPoints = (points: LatLng[]) => {
    const m = mapRef.current;
    const g = (window as any).google as typeof google;
    if (!m || !points.length) return;
    const b = new g.maps.LatLngBounds();
    points.forEach((p) => b.extend(p));
    m.fitBounds(b, 56);
  };

  const ensureClassicMarker = (
    ref: React.MutableRefObject<google.maps.Marker | null>,
    pos: LatLng,
    opts: google.maps.MarkerOptions
  ) => {
    const g = (window as any).google as typeof google;
    const m = mapRef.current;
    if (!m) return;
    if (!ref.current) {
      ref.current = new g.maps.Marker({ map: m, position: pos, ...opts });
    } else {
      ref.current.setOptions({ map: m, position: pos, ...opts });
    }
  };

  // ---------- imperative API --------------------------------------------------

  useImperativeHandle(ref, (): MapCanvasHandle => {
    return {
      setCenter(pos) {
        mapRef.current?.setCenter(pos);
      },
      fitToBounds(points) {
        fitPoints(points);
      },

      setSingleMarker(pos) {
        const g = (window as any).google as typeof google;
        const m = mapRef.current;
        if (!m) return;

        // Clear route & named markers so state is obvious
        this.clearRoute();
        this.clearOriginMarker();
        this.clearDestinationMarker();

        if (haveAdvancedMarkers()) {
          const holder = makeAdvPin("#f59e0b", ORIGIN_GLYPH); // amber for single
          const chip = makeChip(`${ORIGIN_GLYPH} Picked location`);
          const content = stackPinAndChip(holder, chip);
          if (singleAdvRef.current) (singleAdvRef.current as any).map = null;
          singleAdvRef.current = new (g.maps as any).marker.AdvancedMarkerElement({
            map: m,
            position: pos,
            content,
            zIndex: 100,
          });
          singleMarkerRef.current?.setMap(null);
        } else {
          ensureClassicMarker(singleMarkerRef, pos, {
            icon: makeClassicIcon("#f59e0b"),
            title: "Picked location",
            draggable: !!onMarkerDragEnd,
          });
        }

        if (onMarkerDragEnd && singleMarkerRef.current) {
          // (re)bind dragend
          google.maps.event.clearListeners(singleMarkerRef.current, "dragend");
          singleMarkerRef.current.addListener("dragend", () => {
            const p = singleMarkerRef.current!.getPosition();
            if (!p) return;
            onMarkerDragEnd({ lat: p.lat(), lng: p.lng() });
          });
          singleMarkerRef.current.setDraggable(true);
        }

        m.setCenter(pos);
      },
      clearSingleMarker() {
        singleMarkerRef.current?.setMap(null);
        if (singleAdvRef.current) (singleAdvRef.current as any).map = null;
      },

      setOriginMarker(pos) {
        const g = (window as any).google as typeof google;
        const m = mapRef.current;
        if (!m) return;

        if (haveAdvancedMarkers()) {
          const holder = makeAdvPin("#22c55e", ORIGIN_GLYPH); // green
          const chip = makeChip(`${ORIGIN_GLYPH} Origin`);
          const content = stackPinAndChip(holder, chip);
          if (originAdvRef.current) (originAdvRef.current as any).map = null;
          originAdvRef.current = new (g.maps as any).marker.AdvancedMarkerElement({
            map: m,
            position: pos,
            content,
            zIndex: 110,
          });
          originMarkerRef.current?.setMap(null);
        } else {
          ensureClassicMarker(originMarkerRef, pos, {
            icon: makeClassicIcon("#22c55e"),
            title: "Origin",
          });
        }
      },
      setDestinationMarker(pos) {
        const g = (window as any).google as typeof google;
        const m = mapRef.current;
        if (!m) return;

        if (haveAdvancedMarkers()) {
          const holder = makeAdvPin("#ef4444", DEST_GLYPH); // red
          const chip = makeChip(`${DEST_GLYPH} Destination`);
          const content = stackPinAndChip(holder, chip);
          if (destinationAdvRef.current) (destinationAdvRef.current as any).map = null;
          destinationAdvRef.current = new (g.maps as any).marker.AdvancedMarkerElement({
            map: m,
            position: pos,
            content,
            zIndex: 110,
          });
          destinationMarkerRef.current?.setMap(null);
        } else {
          ensureClassicMarker(destinationMarkerRef, pos, {
            icon: makeClassicIcon("#ef4444"),
            title: "Destination",
          });
        }
      },
      clearOriginMarker() {
        originMarkerRef.current?.setMap(null);
        if (originAdvRef.current) (originAdvRef.current as any).map = null;
      },
      clearDestinationMarker() {
        destinationMarkerRef.current?.setMap(null);
        if (destinationAdvRef.current) (destinationAdvRef.current as any).map = null;
      },
      clearAllMarkers() {
        this.clearSingleMarker();
        this.clearOriginMarker();
        this.clearDestinationMarker();
        this.clearHomeMarker();
        this.clearBusinessMarker();
      },

      setHomeMarker(pos, label = "Home") {
        const g = (window as any).google as typeof google;
        const m = mapRef.current;
        if (!m) return;

        if (haveAdvancedMarkers()) {
          const pin = svgToElement(pinSVG("#3b82f6")); // blue
          const chip = makeChip(`${HOME_GLYPH} ${label}`);
          const content = stackPinAndChip(pin, chip);
          if (homeMarkerAdvRef.current) (homeMarkerAdvRef.current as any).map = null;
          homeMarkerAdvRef.current = new (g.maps as any).marker.AdvancedMarkerElement({
            map: m,
            position: pos,
            content,
            zIndex: 105,
          });
          homeMarkerClassicRef.current?.setMap(null);
        } else {
          ensureClassicMarker(homeMarkerClassicRef, pos, {
            icon: makeClassicIcon("#3b82f6"),
            title: label,
          });
          if (homeMarkerAdvRef.current) (homeMarkerAdvRef.current as any).map = null;
        }
      },
      clearHomeMarker() {
        homeMarkerClassicRef.current?.setMap(null);
        if (homeMarkerAdvRef.current) (homeMarkerAdvRef.current as any).map = null;
      },

      setBusinessMarker(pos, label = "Logistics Center") {
        const g = (window as any).google as typeof google;
        const m = mapRef.current;
        if (!m) return;

        if (haveAdvancedMarkers()) {
          const pin = svgToElement(pinSVG("#10b981")); // emerald
          const chip = makeChip(`${BRIEFCASE_GLYPH} ${label}`);
          const content = stackPinAndChip(pin, chip);
          if (businessMarkerAdvRef.current) (businessMarkerAdvRef.current as any).map = null;
          businessMarkerAdvRef.current = new (g.maps as any).marker.AdvancedMarkerElement({
            map: m,
            position: pos,
            content,
            zIndex: 105,
          });
          businessMarkerClassicRef.current?.setMap(null);
        } else {
          ensureClassicMarker(businessMarkerClassicRef, pos, {
            icon: makeClassicIcon("#10b981"),
            title: label,
          });
          if (businessMarkerAdvRef.current) (businessMarkerAdvRef.current as any).map = null;
        }
      },
      clearBusinessMarker() {
        businessMarkerClassicRef.current?.setMap(null);
        if (businessMarkerAdvRef.current) (businessMarkerAdvRef.current as any).map = null;
      },

      async showRoute({
        origin,
        destination,
        travelMode = google.maps.TravelMode.DRIVING,
        avoidTolls,
        avoidHighways,
      }) {
        const g = (window as any).google as typeof google;
        const m = mapRef.current;
        if (!m) return null;

        // Compute directions (we always suppress default markers)
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
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeOpacity: 0.9,
              strokeWeight: 6,
              strokeColor: prefersDark() ? "#60a5fa" : "#2563eb",
            } as google.maps.PolylineOptions,
          });
        } else {
          dirRendererRef.current.setMap(m);
          // re-apply style (handles theme toggles)
          (dirRendererRef.current as any).setOptions?.({
            polylineOptions: {
              strokeOpacity: 0.9,
              strokeWeight: 6,
              strokeColor: prefersDark() ? "#60a5fa" : "#2563eb",
            } as google.maps.PolylineOptions,
          });
        }
        dirRendererRef.current.setDirections(res);

        const route = res.routes[0];
        if (route?.bounds) m.fitBounds(route.bounds, 56);
        else fitPoints([origin, destination]);

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
      style={{ width: "100%", height: "100%", opacity: ready ? 1 : 0.001, borderRadius: 12 }}
    />
  );
});

export default MapCanvas;
