"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  HStack,
  IconButton,
  Spinner,
  Text,
} from "@chakra-ui/react";
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

export default function MapPickerDialog({
  open,
  onClose,
  onConfirm,
  initial,
  countries,
}: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  const [loadingMap, setLoadingMap] = useState(false);
  const [busy, setBusy] = useState(false);

  const [lat, setLat] = useState<number>(initial?.lat ?? 31.771959);
  const [lng, setLng] = useState<number>(initial?.lng ?? 35.217018);
  const [address, setAddress] = useState<string>(initial?.address ?? "");

  const pickedRef = useRef(false);

  const ensureMarker = useCallback((g: typeof google, pos: google.maps.LatLngLiteral) => {
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
  }, []);

  const forwardGeocode = useCallback(
    async (addr: string) => {
      const query = addr?.trim();
      if (!query) return;
      const g = await loadGoogleMaps();
      const geocoder = new g.maps.Geocoder();

      let componentRestrictions: any;
      if (countries) {
        const list = countries.split(",").map((s) => s.trim()).filter(Boolean);
        componentRestrictions = { country: list.length <= 1 ? list[0] : list };
      }

      setBusy(true);
      try {
        const resp = await geocoder.geocode({ address: query, componentRestrictions });
        const result = resp.results?.[0];
        if (!result) return;
        const loc = result.geometry.location;
        const next = { lat: loc.lat(), lng: loc.lng() };
        setLat(next.lat);
        setLng(next.lng);
        setAddress(result.formatted_address || query);
        ensureMarker(g, next);
      } finally {
        setBusy(false);
      }
    },
    [countries, ensureMarker],
  );

  // init map on first open (after Dialog mounts)
  useEffect(() => {
    if (!open) return;
    if (mapRef.current || !boxRef.current) return;

    let cancelled = false;
    (async () => {
      setLoadingMap(true);
      try {
        const g = await loadGoogleMaps();
        if (cancelled || !boxRef.current) return;

        mapRef.current = new g.maps.Map(boxRef.current, {
          center: { lat, lng },
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        await new Promise<void>((resolve) => {
          const once = g.maps.event.addListenerOnce(mapRef.current!, "idle", () => resolve());
          setTimeout(() => {
            g.maps.event.removeListener(once);
            resolve();
          }, 3000);
        });

        mapRef.current.addListener("click", async (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          setLat(pos.lat);
          setLng(pos.lng);
          ensureMarker(g, pos);
          setBusy(true);
          try {
            setAddress((await reverseGeocode(pos.lat, pos.lng)) || "");
          } finally {
            setBusy(false);
          }
        });

        ensureMarker(g, { lat, lng });
      } finally {
        setLoadingMap(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, lat, lng, ensureMarker]);

  // when dialog re-opens, force maps resize + recenter
  useEffect(() => {
    if (!open || !mapRef.current) return;
    (async () => {
      const g = await loadGoogleMaps();
      requestAnimationFrame(() => {
        g.maps.event.trigger(mapRef.current!, "resize");
        mapRef.current!.setCenter({ lat, lng });
      });
    })();
  }, [open, lat, lng]);

  // debounce text geocoding
  useEffect(() => {
    if (!open || !address?.trim() || pickedRef.current) return;
    const t = setTimeout(() => forwardGeocode(address), 600);
    return () => clearTimeout(t);
  }, [open, address, forwardGeocode]);

  const onAddressPicked = (p: { address: string; lat?: number; lng?: number }) => {
    pickedRef.current = true;
    setAddress(p.address);
    if (p.lat != null && p.lng != null) {
      setLat(p.lat);
      setLng(p.lng);
    }
    setTimeout(() => (pickedRef.current = false), 250);
  };

  const useMyLocation = async () => {
    if (!navigator.geolocation) return;
    try {
      setBusy(true);
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        }),
      );
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLat(next.lat);
      setLng(next.lng);
      setAddress((await reverseGeocode(next.lat, next.lng)) || "");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = () => {
    if (!address?.trim() || lat == null || lng == null) return;
    onConfirm({ address: address.trim(), lat, lng });
    onClose();
  };

  return (
    <Dialog.Root size={"lg"} open={open} onOpenChange={(e) => (!e.open ? onClose() : undefined)}>
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
          {/* Header */}
          <Flex
            align="center"
            justify="space-between"
            p={{ base: 3, sm: 4 }}
            borderBottomWidth="1px"
          >
            <Dialog.Title fontSize="lg" fontWeight="semibold">
              Pick a location
            </Dialog.Title>
            <Dialog.CloseTrigger asChild>
              <IconButton aria-label="Close" size="sm" variant="ghost" borderRadius="lg">
                <CloseIcon size={16} />
              </IconButton>
            </Dialog.CloseTrigger>
          </Flex>

          {/* Body (scrollable) */}
          <Box p={{ base: 3, sm: 4 }} flex="1" overflowY="auto" minH={{ base: "260px", sm: "320px" }}>
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

              {/* Map */}
              <Box
                ref={boxRef}
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
              </Box>

              {/* Coordinates & quick action */}
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

          {/* Footer */}
          <Flex p={{ base: 3, sm: 4 }} borderTopWidth="1px" bg="bg" justify="flex-end" gap="2">
            <Dialog.CloseTrigger/>
            <Button borderRadius="xl" colorPalette="blue" onClick={handleConfirm} disabled={!address?.trim()}>
              Use this location
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
