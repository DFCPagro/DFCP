// src/components/common/MapPickerDialog.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, CloseButton, Flex, HStack, Spinner, Text, Field } from "@chakra-ui/react";
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
      markerRef.current = new g.maps.Marker({ position: pos, map: mapRef.current, draggable: true });
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
      if (!addr?.trim()) return;
      const g = await loadGoogleMaps();
      const geocoder = new g.maps.Geocoder();

      let componentRestrictions: any;
      if (countries) {
        const list = countries.split(",").map(s => s.trim()).filter(Boolean);
        componentRestrictions = { country: list.length <= 1 ? list[0] : list };
      }

      setBusy(true);
      try {
        const resp = await geocoder.geocode({ address: addr, componentRestrictions });
        const result = resp.results?.[0];
        if (!result) return;
        const loc = result.geometry.location;
        const next = { lat: loc.lat(), lng: loc.lng() };
        setLat(next.lat);
        setLng(next.lng);
        setAddress(result.formatted_address || addr);
        ensureMarker(g, next);
      } finally {
        setBusy(false);
      }
    },
    [countries, ensureMarker]
  );

  // אתחל מפה בפעם הראשונה שהמודאל נפתח
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
          setTimeout(() => { g.maps.event.removeListener(once); resolve(); }, 3000);
        });

        mapRef.current.addListener("click", async (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          setLat(pos.lat);
          setLng(pos.lng);
          ensureMarker(g, pos);
          setBusy(true);
          try { setAddress((await reverseGeocode(pos.lat, pos.lng)) || ""); }
          finally { setBusy(false); }
        });

        ensureMarker(g, { lat, lng });
      } finally {
        setLoadingMap(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, lat, lng, ensureMarker]);

  // בכל פתיחה מחדש – טריגר resize + recenter (לא מפרקים/בונים DOM)
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

  useEffect(() => {
    if (!open || !address?.trim() || pickedRef.current) return;
    const t = setTimeout(() => forwardGeocode(address), 600);
    return () => clearTimeout(t);
  }, [open, address, forwardGeocode]);

  const onAddressPicked = (p: { address: string; lat?: number; lng?: number }) => {
    pickedRef.current = true;
    setAddress(p.address);
    if (p.lat != null && p.lng != null) { setLat(p.lat); setLng(p.lng); }
    setTimeout(() => (pickedRef.current = false), 250);
  };

  const useMyLocation = async () => {
    if (!navigator.geolocation) return;
    try {
      setBusy(true);
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLat(next.lat); setLng(next.lng);
      setAddress((await reverseGeocode(next.lat, next.lng)) || "");
    } finally { setBusy(false); }
  };

  const handleConfirm = () => {
    if (!address || lat == null || lng == null) return;
    onConfirm({ address, lat, lng });
    onClose();
  };

  return (
    // Overlay “פשוט” – תמיד קיים ב-DOM; רק מציג/מסתיר
    <Box
      // כשסגור: לא נראה ולא תופס אינטראקציות, אבל נשאר ב-DOM
      style={{ display: open ? "block" : "none" }}
      position="fixed"
      inset="0"
      zIndex={1000}
    >
      {/* רקע כהה */}
      <Box position="absolute" inset="0" bg="blackAlpha.500" onClick={onClose} />

      {/* תוכן המודאל */}
      <Flex
        position="absolute"
        inset="0"
        align="center"
        justify="center"
        p="4"
      >
        <Box bg="white" rounded="lg" shadow="lg" w="min(960px, 96vw)">
          <Flex align="center" justify="space-between" p="4" borderBottomWidth="1px">
            <Text fontWeight="semibold">Pick a location</Text>
            <CloseButton onClick={onClose} />
          </Flex>

          <Box p="4">
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
                ref={boxRef}
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
                  <Flex position="absolute" inset={0} align="center" justify="center" bg="blackAlpha.200" zIndex={1}>
                    <HStack><Spinner size="sm" /><Text fontSize="sm">{loadingMap ? "Loading map..." : "Loading..."}</Text></HStack>
                  </Flex>
                )}
              </Box>

              <Flex gap="6" wrap="wrap">
                <Box>
                  <Text fontWeight="medium">Latitude</Text>
                  <Text fontSize="sm" color="gray.600">{lat != null ? lat.toFixed(6) : "Not set"}</Text>
                </Box>
                <Box>
                  <Text fontWeight="medium">Longitude</Text>
                  <Text fontSize="sm" color="gray.600">{lng != null ? lng.toFixed(6) : "Not set"}</Text>
                </Box>
              </Flex>

              <Button onClick={useMyLocation} variant="subtle" alignSelf="flex-start">
                Use my current location
              </Button>
            </Flex>
          </Box>

          <Flex p="4" gap="2" justify="flex-end" borderTopWidth="1px">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button colorPalette="primary" onClick={handleConfirm} disabled={!address}>
              Use this location
            </Button>
          </Flex>
        </Box>
      </Flex>
    </Box>
  );
}
