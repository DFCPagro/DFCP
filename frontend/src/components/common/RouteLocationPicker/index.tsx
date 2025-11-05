"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  HStack,
  IconButton,
  NativeSelect,
  Separator,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { ArrowRightLeftIcon as SwapIcon, X as CloseIcon } from "lucide-react";
import AddressAutocomplete from "@/components/common/AddressAutocomplete";
import MapCanvas, { type LatLng, type MapCanvasHandle } from "@/components/common/RouteLocationPicker/MapCanvas";
import { loadGoogleMaps, reverseGeocode } from "@/utils/googleMaps";

export type TravelMode = "DRIVING" | "WALKING" | "BICYCLING" | "TRANSIT";
export type PointValue = { address: string; lat: number; lng: number };
export type Mode = "point" | "route";
export type ViewMode = "edit" | "view";

type BaseProps = {
  open: boolean;
  onClose: () => void;
  viewMode?: ViewMode;
  countries?: string;
  size?: "sm" | "md" | "lg";
};

type PointOnlyProps = BaseProps & {
  mode: "point";
  initialPoint?: PointValue;
  onConfirm?: (v: PointValue) => void;
};

type RouteProps = BaseProps & {
  mode: "route";
  initialOrigin?: PointValue;
  initialDestination?: PointValue;
  initialTravelMode?: TravelMode;
  onConfirm?: (v: {
    origin: PointValue;
    destination: PointValue;
    travelMode: TravelMode;
    distanceText?: string;
    durationText?: string;
  }) => void;
};

type Props = PointOnlyProps | RouteProps;

const DEFAULT_CENTER: LatLng = { lat: 31.771959, lng: 35.217018 };

export default function LocationRouteDialog(props: Props) {
  const { open, onClose, countries, size = "lg" } = props;
  const viewMode = props.viewMode ?? "edit";

  const [busy, setBusy] = useState(false);
  const [loadingMap, setLoadingMap] = useState(false);

  // map readiness state to avoid painting too early
  const [mapReady, setMapReady] = useState(false);

  const [point, setPoint] = useState<PointValue | undefined>(
    props.mode === "point" && props.initialPoint ? props.initialPoint : undefined,
  );

  const [origin, setOrigin] = useState<PointValue | undefined>(
    props.mode === "route" && props.initialOrigin ? props.initialOrigin : undefined,
  );
  const [destination, setDestination] = useState<PointValue | undefined>(
    props.mode === "route" && props.initialDestination ? props.initialDestination : undefined,
  );
  const [travelMode, setTravelMode] = useState<TravelMode>(
    props.mode === "route" ? props.initialTravelMode ?? "DRIVING" : "DRIVING",
  );
  const [distanceText, setDistanceText] = useState<string | undefined>(undefined);
  const [durationText, setDurationText] = useState<string | undefined>(undefined);

  // Refs that mirror latest origin/destination to avoid stale closure during async geocoding
  const originRef = useRef<PointValue | undefined>(origin);
  const destinationRef = useRef<PointValue | undefined>(destination);
  useEffect(() => { originRef.current = origin; }, [origin]);
  useEffect(() => { destinationRef.current = destination; }, [destination]);

  const mapRef = useRef<MapCanvasHandle | null>(null);

  const center = useMemo<LatLng>(() => {
    if (props.mode === "point") {
      return point ? { lat: point.lat, lng: point.lng } : DEFAULT_CENTER;
    }
    return origin
      ? { lat: origin.lat, lng: origin.lng }
      : destination
      ? { lat: destination.lat, lng: destination.lng }
      : DEFAULT_CENTER;
  }, [props.mode, point, origin, destination]);

  const ensureMaps = useCallback(async () => {
    setLoadingMap(true);
    try {
      await loadGoogleMaps(); // idempotent
    } finally {
      setLoadingMap(false);
    }
  }, []);

  // When dialog opens, ensure maps and reset readiness
  useEffect(() => {
    if (!open) return;
    ensureMaps();
    setMapReady(false);
  }, [open, ensureMaps]);

  // keep internal point in sync with incoming initialPoint (important for view mode)
  useEffect(() => {
  if (props.mode === "point" && "initialPoint" in props) {
    setPoint(props.initialPoint);
  } else if (props.mode === "point") {
    setPoint(undefined);
  }
  // no change for route mode
}, [props]);

  // Paint current state whenever open/mapReady/state changes
  useEffect(() => {
    if (!open || !mapRef.current || !mapReady) return;

    const paint = async () => {
      if (props.mode === "point") {
        mapRef.current.clearRoute();
        mapRef.current.clearAllMarkers();
        if (point) {
          mapRef.current.setSingleMarker(point);
          mapRef.current.setCenter(point);
        } else {
          mapRef.current.setCenter(center);
        }
        return;
      }

      // route mode
      mapRef.current.clearRoute();

      // Show both markers if we have them (always visible)
      mapRef.current.clearAllMarkers();
      if (origin) mapRef.current.setOriginMarker(origin);
      if (destination) mapRef.current.setDestinationMarker(destination);

      if (origin && destination) {
        // Fit to endpoints immediately for snappy UX
        mapRef.current.fitToBounds([origin, destination]);
        await renderRoute(origin, destination, travelMode);
      } else if (origin || destination) {
        // If only one exists, center on it
        mapRef.current.setCenter(origin ?? destination!);
      } else {
        mapRef.current.setCenter(center);
      }
    };

    const id = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mapReady, point?.lat, point?.lng, origin?.lat, origin?.lng, destination?.lat, destination?.lng, travelMode]);

  // Click-to-pick with immediate placement (avoid race with async reverseGeocode)
  const onMapClick = async (pos: LatLng) => {
    if (viewMode === "view") return;

    // Read latest values from refs to avoid stale closure
    const curOrigin = originRef.current;
    const curDestination = destinationRef.current;

    if (props.mode === "point") {
      // Immediately set marker, then resolve address
      const provisional: PointValue = { address: "", ...pos };
      setPoint(provisional);
      mapRef.current?.setSingleMarker(provisional);
      mapRef.current?.setCenter(provisional);

      setBusy(true);
      try {
        const addr = (await reverseGeocode(pos.lat, pos.lng)) || "";
        setPoint((s) => (s ? { ...s, address: addr } : { address: addr, ...pos }));
      } finally {
        setBusy(false);
      }
      return;
    }

    // ROUTE MODE
    if (!curOrigin) {
      const provisional: PointValue = { address: "", ...pos };
      originRef.current = provisional; // keep ref in sync immediately
      setOrigin(provisional);
      mapRef.current?.setOriginMarker(provisional);

      setBusy(true);
      try {
        const addr = (await reverseGeocode(pos.lat, pos.lng)) || "";
        setOrigin((s) => (s ? { ...s, address: addr } : { address: addr, ...pos }));
        originRef.current = { address: addr, ...pos };
      } finally {
        setBusy(false);
      }
      return;
    }

    // If we already have origin, set/replace destination
    const provisionalDest: PointValue = { address: "", ...pos };
    destinationRef.current = provisionalDest;
    setDestination(provisionalDest);
    mapRef.current?.setDestinationMarker(provisionalDest);
    mapRef.current?.fitToBounds([curOrigin, provisionalDest]);

    setBusy(true);
    try {
      const addr = (await reverseGeocode(pos.lat, pos.lng)) || "";
      const finalizedDest: PointValue = { address: addr, ...pos };
      setDestination(finalizedDest);
      destinationRef.current = finalizedDest;
      await renderRoute(curOrigin, finalizedDest, travelMode);
    } finally {
      setBusy(false);
    }
  };

  const onMarkerDragEnd = async (pos: LatLng) => {
    if (viewMode === "view") return;

    setBusy(true);
    try {
      const addr = (await reverseGeocode(pos.lat, pos.lng)) || "";
      if (props.mode === "point") {
        const next = { address: addr, ...pos };
        setPoint(next);
      }
      // Note: the named markers are not draggable in this implementation.
    } finally {
      setBusy(false);
    }
  };

  const onPickedFromSearch =
    (kind: "point" | "origin" | "destination") =>
    async (p: { address: string; lat?: number; lng?: number }) => {
      const lat = p.lat ?? null;
      const lng = p.lng ?? null;
      if (lat == null || lng == null) return;

      const next = { address: p.address, lat, lng };
      if (kind === "point") {
        setPoint(next);
        mapRef.current?.setSingleMarker(next);
        mapRef.current?.setCenter(next);
      } else if (kind === "origin") {
        originRef.current = next;
        setOrigin(next);
        mapRef.current?.setOriginMarker(next);
        if (destinationRef.current) {
          mapRef.current?.fitToBounds([next, destinationRef.current]);
          await renderRoute(next, destinationRef.current, travelMode);
        } else {
          mapRef.current?.setCenter(next);
        }
      } else {
        destinationRef.current = next;
        setDestination(next);
        mapRef.current?.setDestinationMarker(next);
        if (originRef.current) {
          mapRef.current?.fitToBounds([originRef.current, next]);
          await renderRoute(originRef.current, next, travelMode);
        } else {
          mapRef.current?.setCenter(next);
        }
      }
    };

  const renderRoute = async (o: PointValue, d: PointValue, tm: TravelMode) => {
    setBusy(true);
    try {
      const res = await mapRef.current?.showRoute({
        origin: { lat: o.lat, lng: o.lng },
        destination: { lat: d.lat, lng: d.lng },
        travelMode: (window as any).google?.maps.TravelMode[tm] ?? google.maps.TravelMode.DRIVING,
        suppressRendererMarkers: true, // keep our A/B markers visible
      });
      if (res?.routes[0]?.legs?.[0]) {
        const leg = res.routes[0].legs[0];
        setDistanceText(leg.distance?.text);
        setDurationText(leg.duration?.text);
      } else {
        setDistanceText(undefined);
        setDurationText(undefined);
      }
      return res ?? null;
    } finally {
      setBusy(false);
    }
  };

  const swapRoute = async () => {
    if (!originRef.current || !destinationRef.current) return;
    const nextOrigin = destinationRef.current;
    const nextDestination = originRef.current;

    originRef.current = nextOrigin;
    destinationRef.current = nextDestination;

    setOrigin(nextOrigin);
    setDestination(nextDestination);

    // Update markers immediately for visual feedback
    mapRef.current?.setOriginMarker(nextOrigin);
    mapRef.current?.setDestinationMarker(nextDestination);

    mapRef.current?.fitToBounds([nextOrigin, nextDestination]);
    await renderRoute(nextOrigin, nextDestination, travelMode);
  };

  const canConfirm = useMemo(() => {
    if (viewMode === "view") return true;
    if (props.mode === "point") return !!point?.address && point.lat != null && point.lng != null;
    return !!originRef.current && !!destinationRef.current;
  }, [viewMode, props.mode, point]);

  const handleConfirm = () => {
    if (!props.onConfirm) return;
    if (props.mode === "point" && point) {
      props.onConfirm(point);
    } else if (props.mode === "route" && originRef.current && destinationRef.current) {
      props.onConfirm({
        origin: originRef.current,
        destination: destinationRef.current,
        travelMode,
        distanceText,
        durationText,
      });
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size={size}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content borderRadius="2xl" overflow="hidden" shadow="lg" borderWidth="1px" display="flex" flexDirection="column">
          <Flex align="center" justify="space-between" p={{ base: 3, sm: 4 }} borderBottomWidth="1px">
            <Dialog.Title fontSize="lg" fontWeight="semibold">
              {props.mode === "point" ? (viewMode === "view" ? "Location" : "Pick a location") : viewMode === "view" ? "Route" : "Plan a route"}
            </Dialog.Title>
            <Dialog.CloseTrigger asChild>
              <IconButton aria-label="Close" size="sm" variant="ghost" borderRadius="lg">
                <CloseIcon size={16} />
              </IconButton>
            </Dialog.CloseTrigger>
          </Flex>

          <Box p={{ base: 3, sm: 4 }} flex="1" overflowY="auto" minH={{ base: "320px", sm: "380px" }}>
            <Flex direction="column" gap="3">
              {props.mode === "point" ? (
                <Field.Root>
                  <Field.Label>Search</Field.Label>
                  <AddressAutocomplete
                    value={point?.address ?? ""}
                    onChange={(v) => setPoint((s) => (s ? { ...s, address: v } : { address: v, ...DEFAULT_CENTER }))}
                    onPlaceSelected={onPickedFromSearch("point")}
                    countries={countries}
                    placeholder="Search for an address"
                    disabled={viewMode === "view"}
                  />
                </Field.Root>
              ) : (
                <>
                  <Flex gap="2" direction={{ base: "column", sm: "row" }} align="stretch">
                    <Box flex="1">
                      <Field.Root>
                        <Field.Label>Origin</Field.Label>
                        <AddressAutocomplete
                          value={origin?.address ?? ""}
                          onChange={(v) => setOrigin((s) => (s ? { ...s, address: v } : { address: v, ...DEFAULT_CENTER }))}
                          onPlaceSelected={onPickedFromSearch("origin")}
                          countries={countries}
                          placeholder="Search origin"
                          disabled={viewMode === "view"}
                        />
                      </Field.Root>
                    </Box>
                    <Box alignSelf={{ base: "stretch", sm: "end" }}>
                      <IconButton
                        aria-label="Swap"
                        onClick={swapRoute}
                        variant="subtle"
                        borderRadius="lg"
                        disabled={viewMode === "view" || !originRef.current || !destinationRef.current}
                      >
                        <SwapIcon size={18} />
                      </IconButton>
                    </Box>
                    <Box flex="1">
                      <Field.Root>
                        <Field.Label>Destination</Field.Label>
                        <AddressAutocomplete
                          value={destination?.address ?? ""}
                          onChange={(v) => setDestination((s) => (s ? { ...s, address: v } : { address: v, ...DEFAULT_CENTER }))}
                          onPlaceSelected={onPickedFromSearch("destination")}
                          countries={countries}
                          placeholder="Search destination"
                          disabled={viewMode === "view"}
                        />
                      </Field.Root>
                    </Box>
                  </Flex>

                  <Flex gap="3" align="center" wrap="wrap">
                    <Field.Root>
                      <Field.Label>Travel mode</Field.Label>
                      <NativeSelect.Root width="200px" disabled={viewMode === "view"}>
                        <NativeSelect.Field
                          value={travelMode}
                          onChange={async (e) => {
                            const next = e.target.value as TravelMode;
                            setTravelMode(next);
                            if (originRef.current && destinationRef.current) {
                              mapRef.current?.fitToBounds([originRef.current, destinationRef.current]);
                              await renderRoute(originRef.current, destinationRef.current, next);
                            }
                          }}
                        >
                          <option value="DRIVING">Driving</option>
                          <option value="WALKING">Walking</option>
                          <option value="BICYCLING">Bicycling</option>
                          <option value="TRANSIT">Transit</option>
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    </Field.Root>

                    <Separator orientation="vertical" height="8" />

                    <Flex gap="6" align="center">
                      <Box>
                        <Text fontSize="xs" color="gray.500">Distance</Text>
                        <Text fontWeight="medium">{distanceText ?? "—"}</Text>
                      </Box>
                      <Box>
                        <Text fontSize="xs" color="gray.500">Duration</Text>
                        <Text fontWeight="medium">{durationText ?? "—"}</Text>
                      </Box>
                    </Flex>
                  </Flex>
                </>
              )}

              <Box
                w="100%"
                h={{ base: "42vh", sm: "48vh", md: "52vh" }}
                minH="260px"
                maxH="62vh"
                rounded="md"
                borderWidth="1px"
                borderColor="gray.200"
                _dark={{ borderColor: "whiteAlpha.300", bg: "gray.900" }}
                overflow="hidden"
                position="relative"
                bg="gray.50"
              >
                {(loadingMap || busy) && (
                  <Flex position="absolute" inset={0} align="center" justify="center" bg="blackAlpha.200" zIndex={1}>
                    <HStack>
                      <Spinner size="sm" />
                      <Text fontSize="sm">{loadingMap ? "Loading map..." : "Loading..."}</Text>
                    </HStack>
                  </Flex>
                )}
                <MapCanvas
                  ref={mapRef}
                  initialCenter={center}
                  onMapReady={() => setMapReady(true)}                      
                  onClick={viewMode === "view" ? undefined : onMapClick}
                  onMarkerDragEnd={viewMode === "view" ? undefined : onMarkerDragEnd}
                  className="chakra-map"
                />
              </Box>

              {props.mode === "point" && (
                <Flex gap="6" wrap="wrap">
                  <Box>
                    <Text fontWeight="medium">Latitude</Text>
                    <Text fontSize="sm" color="gray.600" _dark={{ color: "gray.300" }}>
                      {point?.lat != null ? point.lat.toFixed(6) : "Not set"}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontWeight="medium">Longitude</Text>
                    <Text fontSize="sm" color="gray.600" _dark={{ color: "gray.300" }}>
                      {point?.lng != null ? point.lng.toFixed(6) : "Not set"}
                    </Text>
                  </Box>
                </Flex>
              )}
            </Flex>
          </Box>

          <Flex p={{ base: 3, sm: 4 }} borderTopWidth="1px" bg="bg" justify="flex-end" gap="2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            {viewMode === "edit" && (
              <Button colorPalette="blue" borderRadius="xl" onClick={handleConfirm} disabled={!canConfirm}>
                {props.mode === "point" ? "Use this location" : "Use this route"}
              </Button>
            )}
          </Flex>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
