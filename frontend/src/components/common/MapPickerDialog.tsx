// src/components/common/MapPickerDialog.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Dialog, Field, Flex, HStack, IconButton, Spinner, Text } from "@chakra-ui/react";
import { X as CloseIcon } from "lucide-react";
import AddressAutocomplete from "@/components/common/AddressAutocomplete";
import { loadGoogleMaps, reverseGeocode } from "@/utils/googleMaps";

type MapPickerValue = { address: string; lat: number; lng: number };
type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (v: MapPickerValue) => void;
  initial?: { lat: number; lng: number; address?: string };
  countries?: string;
};

export default function MapPickerDialog({ open, onClose, onConfirm, initial, countries }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);

  const [loadingMap, setLoadingMap] = useState(false);
  const [busy, setBusy] = useState(false);

  const [lat, setLat] = useState<number>(initial?.lat ?? 31.771959);
  const [lng, setLng] = useState<number>(initial?.lng ?? 35.217018);
  const [address, setAddress] = useState<string>(initial?.address ?? "");

  const cleanupMap = useCallback(() => {
    try {
      listenersRef.current.forEach((l) => l.remove());
      listenersRef.current = [];
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
      // IMPORTANT: clear host so we don’t reuse stale children
      if (hostRef.current) hostRef.current.innerHTML = "";
    } catch {}
  }, []);

  const waitForSize = useCallback(async () => {
    const el = hostRef.current;
    if (!el) return;
    const ready = () => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    if (ready()) return;

    await new Promise<void>((resolve) => {
      let done = false;
      const ro =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(() => {
              if (!done && ready()) {
                done = true;
                ro.disconnect();
                resolve();
              }
            })
          : null;

      if (ro) ro.observe(el);

      const tick = () => {
        if (!done && ready()) {
          done = true;
          ro?.disconnect();
          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
  }, []);

  const setMarker = useCallback((g: typeof google, pos: google.maps.LatLngLiteral) => {
    if (!mapRef.current) return;
    if (!markerRef.current) {
      markerRef.current = new g.maps.Marker({ position: pos, map: mapRef.current, draggable: true });
      listenersRef.current.push(
        markerRef.current.addListener("dragend", async () => {
          const p = markerRef.current!.getPosition();
          if (!p) return;
          const next = { lat: p.lat(), lng: p.lng() };
          setLat(next.lat);
          setLng(next.lng);
          setBusy(true);
          try {
            setAddress((await reverseGeocode(next.lat, next.lng)) || "");
          } finally {
            setBusy(false);
          }
        })
      );
    } else {
      markerRef.current.setPosition(pos);
    }
    mapRef.current.setCenter(pos);
  }, []);

  // Create a brand new map each OPEN
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    (async () => {
      setLoadingMap(true);
      try {
        await loadGoogleMaps();
        await waitForSize();
        if (cancelled || !hostRef.current) return;

        const g = (window as any).google as typeof google;
        // fresh map each time
        mapRef.current = new g.maps.Map(hostRef.current, {
          center: { lat, lng },
          zoom: 14,
          gestureHandling: "greedy",
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
        });

        listenersRef.current.push(
          mapRef.current.addListener("click", async (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return;
            const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            setLat(pos.lat);
            setLng(pos.lng);
            setMarker(g, pos);
            setBusy(true);
            try {
              setAddress((await reverseGeocode(pos.lat, pos.lng)) || "");
            } finally {
              setBusy(false);
            }
          })
        );

        setMarker(g, { lat, lng });

        requestAnimationFrame(() => {
          if (!mapRef.current) return;
          g.maps.event.trigger(mapRef.current, "resize");
          mapRef.current.setCenter({ lat, lng });
        });
      } finally {
        setLoadingMap(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lat, lng]);

  // HARD dispose when it closes (no key required)
  useEffect(() => {
    if (open) return;
    cleanupMap();
  }, [open, cleanupMap]);

  // safety on unmount
  useEffect(() => cleanupMap, [cleanupMap]);

  const onPickedFromSearch = (p: { address: string; lat?: number; lng?: number }) => {
    setAddress(p.address);
    if (p.lat != null && p.lng != null) {
      setLat(p.lat);
      setLng(p.lng);
      if (mapRef.current) {
        const g = (window as any).google as typeof google;
        setMarker(g, { lat: p.lat, lng: p.lng });
      }
    }
  };

  const useMyLocation = async () => {
    if (!navigator.geolocation) return;
    try {
      setBusy(true);
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      );
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLat(next.lat);
      setLng(next.lng);
      setAddress((await reverseGeocode(next.lat, next.lng)) || "");
      if (mapRef.current) {
        const g = (window as any).google as typeof google;
        setMarker(g, next);
      }
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!address?.trim() || lat == null || lng == null) return;
    onConfirm({ address: address.trim(), lat, lng });
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          borderRadius="2xl"
          overflow="hidden"
          shadow="lg"
          borderWidth="1px"
          display="flex"
          flexDirection="column"
        >
          <Flex align="center" justify="space-between" p={{ base: 3, sm: 4 }} borderBottomWidth="1px">
            <Dialog.Title fontSize="lg" fontWeight="semibold">Pick a location</Dialog.Title>
            <Dialog.CloseTrigger asChild>
              <IconButton aria-label="Close" size="sm" variant="ghost" borderRadius="lg">
                <CloseIcon size={16} />
              </IconButton>
            </Dialog.CloseTrigger>
          </Flex>

          <Box p={{ base: 3, sm: 4 }} flex="1" overflowY="auto" minH={{ base: "260px", sm: "320px" }}>
            <Flex direction="column" gap="3">
              <Field.Root>
                <Field.Label>Search</Field.Label>
                <AddressAutocomplete
                  value={address}
                  onChange={setAddress}
                  onPlaceSelected={onPickedFromSearch}
                  countries={countries}
                  placeholder="Search for an address"
                />
              </Field.Root>

              <Box
                w="100%"
                h={{ base: "42vh", sm: "48vh", md: "52vh" }}
                minH="240px"
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
                <div ref={hostRef} style={{ width: "100%", height: "100%" }} />
              </Box>

              <Flex gap="6" wrap="wrap">
                <Box>
                  <Text fontWeight="medium">Latitude</Text>
                  <Text fontSize="sm" color="gray.600" _dark={{ color: "gray.300" }}>
                    {lat != null ? lat.toFixed(6) : "Not set"}
                  </Text>
                </Box>
                <Box>
                  <Text fontWeight="medium">Longitude</Text>
                  <Text fontSize="sm" color="gray.600" _dark={{ color: "gray.300" }}>
                    {lng != null ? lng.toFixed(6) : "Not set"}
                  </Text>
                </Box>
              </Flex>

              <Button onClick={useMyLocation} variant="subtle" alignSelf={{ base: "stretch", sm: "flex-start" }}>
                Use my current location
              </Button>
            </Flex>
          </Box>

          <Flex p={{ base: 3, sm: 4 }} borderTopWidth="1px" bg="bg" justify="flex-end" gap="2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button borderRadius="xl" colorPalette="blue" onClick={confirm} disabled={!address?.trim()}>
              Use this location
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
