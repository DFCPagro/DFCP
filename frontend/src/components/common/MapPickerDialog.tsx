"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  Box,
  Portal,
  Button,
  CloseButton,
  Field,
  Flex,
  HStack,
  Text,
  Spinner,
} from "@chakra-ui/react";
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

export default function MapPickerDialog({
  open,
  onClose,
  onConfirm,
  initial,
  countries,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const initializingRef = useRef(false);

  const [loadingMap, setLoadingMap] = useState(false);
  const [busy, setBusy] = useState(false);

  const [lat, setLat] = useState<number>(initial?.lat ?? 31.771959);
  const [lng, setLng] = useState<number>(initial?.lng ?? 35.217018);
  const [address, setAddress] = useState<string>(initial?.address ?? "");

  // Flag to skip debounce right after a place is picked from autocomplete
  const lastAddressFromPickRef = useRef(false);

  const cleanupMap = useCallback(() => {
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    mapRef.current = null;
    initializingRef.current = false;
  }, []);

  useEffect(() => {
    if (!open) {
      cleanupMap();
      setLoadingMap(false);
      setBusy(false);
    }
  }, [open, cleanupMap]);

  const updateMarker = useCallback(
    (g: typeof google, pos: google.maps.LatLngLiteral) => {
      if (!mapRef.current) return;

      if (!markerRef.current) {
        markerRef.current = new g.maps.Marker({
          position: pos,
          map: mapRef.current,
          draggable: true,
        });

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
        });
      } else {
        markerRef.current.setPosition(pos);
      }
      mapRef.current.setCenter(pos);
    },
    []
  );

  const reverseFromState = useCallback(async (lat: number, lng: number) => {
    setBusy(true);
    try {
      setAddress((await reverseGeocode(lat, lng)) || "");
    } finally {
      setBusy(false);
    }
  }, []);

  // 🔎 Forward geocode when user TYPES an address (not selecting a place)
  const forwardGeocode = useCallback(
    async (addr: string) => {
      if (!addr?.trim()) return;
      const g = await loadGoogleMaps();
      const geocoder = new g.maps.Geocoder();

      let componentRestrictions: any = undefined;
      if (countries) {
        const list = countries
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        componentRestrictions = { country: list.length <= 1 ? list[0] : list };
      }

      setBusy(true);
      try {
        const resp = await geocoder.geocode({
          address: addr,
          componentRestrictions,
        });
        const result = resp.results?.[0];
        if (!result) return;
        const loc = result.geometry.location;
        const next = { lat: loc.lat(), lng: loc.lng() };
        setLat(next.lat);
        setLng(next.lng);
        setAddress(result.formatted_address || addr);
        updateMarker(g, next);
      } finally {
        setBusy(false);
      }
    },
    [countries, updateMarker]
  );

  // Initialize map when dialog opens
  useEffect(() => {
    if (!open || initializingRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;
    initializingRef.current = true;

    const initialize = async () => {
      try {
        setLoadingMap(true);

        // wait until container has layout and is visible
        await new Promise<void>((resolve) => {
          const check = () => {
            const rect = container.getBoundingClientRect();
            const ready =
              rect.width > 0 &&
              rect.height > 0 &&
              container.offsetParent !== null;
            if (ready) resolve();
            else setTimeout(check, 40);
          };
          check();
        });
        if (!mounted) return;

        const g = await loadGoogleMaps();
        if (!mounted) return;

        if (!mapRef.current) {
          mapRef.current = new g.maps.Map(container, {
            center: { lat, lng },
            zoom: 14,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });

          await new Promise<void>((resolve) => {
            const once = g.maps.event.addListenerOnce(
              mapRef.current!,
              "idle",
              () => resolve()
            );
            setTimeout(() => {
              g.maps.event.removeListener(once);
              resolve();
            }, 4000);
          });

          mapRef.current.addListener(
            "click",
            async (e: google.maps.MapMouseEvent) => {
              if (!e.latLng) return;
              const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
              setLat(pos.lat);
              setLng(pos.lng);
              updateMarker(g, pos);
              setBusy(true);
              try {
                setAddress((await reverseGeocode(pos.lat, pos.lng)) || "");
              } finally {
                setBusy(false);
              }
            }
          );
        } else {
          mapRef.current.setCenter({ lat, lng });
        }

        updateMarker(g, { lat, lng });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Map init failed:", e);
      } finally {
        if (mounted) {
          setLoadingMap(false);
          initializingRef.current = false;
        }
      }
    };

    const t = setTimeout(initialize, 80);
    return () => {
      mounted = false;
      clearTimeout(t);
      initializingRef.current = false;
    };
  }, [open, lat, lng, updateMarker]);

  // Move marker if lat/lng change from inputs or geolocation
  useEffect(() => {
    if (!open || !mapRef.current) return;
    (async () => {
      const g = await loadGoogleMaps();
      updateMarker(g, { lat, lng });
    })();
  }, [open, lat, lng, updateMarker]);

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
    } finally {
      setBusy(false);
    }
  };

  // ✅ When a place is picked from the dropdown
  const onAddressPicked = async (p: {
    address: string;
    lat?: number;
    lng?: number;
  }) => {
    lastAddressFromPickRef.current = true;
    setAddress(p.address);
    if (p.lat != null && p.lng != null) {
      setLat(p.lat);
      setLng(p.lng);
    }
    // allow future manual typing to trigger debounce again
    setTimeout(() => (lastAddressFromPickRef.current = false), 250);
  };

  // ✅ Debounce manual typing → forward geocode (keeps map in sync even if not selecting a dropdown option)
  useEffect(() => {
    if (!open) return;
    if (!address?.trim()) return;
    if (lastAddressFromPickRef.current) return;

    const t = setTimeout(() => {
      forwardGeocode(address);
    }, 600);
    return () => clearTimeout(t);
  }, [open, address, forwardGeocode]);

  const handleConfirm = () => {
    if (!address || lat == null || lng == null) return;
    onConfirm({ address, lat, lng });
    handleClose();
  };

  const handleClose = () => {
    cleanupMap();
    onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && handleClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="3xl">
            <Dialog.Header>
              <Dialog.Title>Pick a location</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body>
              <Flex direction="column" gap="3">
                <Field.Root>
                  <Field.Label>Search</Field.Label>
                  <AddressAutocomplete
                    value={address}
                    onChange={setAddress}
                    onPlaceSelected={onAddressPicked}
                    countries={countries}
                    placeholder="Search for an address"
                  />
                </Field.Root>

                <Box
                  key={open ? "map-open" : "map-closed"}
                  ref={containerRef}
                  w="100%"
                  h="360px"
                  minH="360px"
                  rounded="md"
                  borderWidth="1px"
                  borderColor="gray.200"
                  overflow="hidden"
                  position="relative"
                  bg="gray.50"
                >
                  {(loadingMap || busy) && (
                    <Flex
                      position="absolute"
                      inset={0}
                      align="center"
                      justify="center"
                      bg="blackAlpha.200"
                      zIndex={1}
                    >
                      <HStack>
                        <Spinner size="sm" />
                        <Text fontSize="sm">
                          {loadingMap ? "Loading map..." : "Loading..."}
                        </Text>
                      </HStack>
                    </Flex>
                  )}
                </Box>

                <Flex gap="6" wrap="wrap">
                  <Box>
                    <Text fontWeight="medium">Latitude</Text>
                    <Text fontSize="sm" color="gray.600">
                      {lat != null ? lat.toFixed(6) : "Not set"}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontWeight="medium">Longitude</Text>
                    <Text fontSize="sm" color="gray.600">
                      {lng != null ? lng.toFixed(6) : "Not set"}
                    </Text>
                  </Box>
                </Flex>

                <Button
                  onClick={useMyLocation}
                  variant="subtle"
                  alignSelf="flex-start"
                >
                  Use my current location
                </Button>
              </Flex>
            </Dialog.Body>

            <Dialog.Footer gap="2">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                colorPalette="primary"
                onClick={handleConfirm}
                disabled={!address}
              >
                Use this location
              </Button>
            </Dialog.Footer>

            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
