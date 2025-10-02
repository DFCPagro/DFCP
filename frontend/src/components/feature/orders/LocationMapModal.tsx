// src/components/feature/orders/LocationMapModal.tsx
import { useEffect, useRef } from "react";
import { Box, Button, Dialog, Text } from "@chakra-ui/react";
import { loadGoogleMaps } from "@/utils/googleMaps";

type LatLng = { lat: number; lng: number };
const LOGISTIC_CENTER: LatLng = { lat: 32.733459, lng: 35.218805 };

export default function LocationMapModal({
  open,
  onClose,
  point,
  onlyDelivery = false,
}: {
  open: boolean;
  onClose: () => void;
  point?: LatLng;
  onlyDelivery?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);

  const gRef = useRef<typeof google | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);
  const lcMarkerRef = useRef<google.maps.Marker | null>(null);
  const routeRef = useRef<google.maps.Polyline | null>(null);

  async function waitForSize(el: HTMLElement) {
    if (el.clientWidth > 0 && el.clientHeight > 0) return;
    await new Promise<void>((resolve) => {
      const ro = new ResizeObserver(() => {
        if (el.clientWidth > 0 && el.clientHeight > 0) {
          ro.disconnect();
          resolve();
        }
      });
      ro.observe(el);
    });
  }

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!open || !boxRef.current) return;
      const el = boxRef.current;

      await waitForSize(el);
      if (cancelled) return;

      const g = await loadGoogleMaps();
      if (cancelled) return;
      gRef.current = g;

      el.innerHTML = "";

      const center =
        point && !onlyDelivery
          ? {
              lat: (LOGISTIC_CENTER.lat + point.lat) / 2,
              lng: (LOGISTIC_CENTER.lng + point.lng) / 2,
            }
          : point ?? LOGISTIC_CENTER;

      mapRef.current = new g.maps.Map(el, {
        center,
        zoom: 13,
        mapTypeId: g.maps.MapTypeId.ROADMAP,
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        mapTypeControl: false,
        gestureHandling: "greedy",
        clickableIcons: false,
      });

      requestAnimationFrame(() => g.maps.event.trigger(mapRef.current!, "resize"));
      drawOverlays();
    };

    void init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    drawOverlays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, point?.lat, point?.lng, onlyDelivery]);

  function clearOverlays() {
    routeRef.current?.setMap(null);
    lcMarkerRef.current?.setMap(null);
    destMarkerRef.current?.setMap(null);
    routeRef.current = null;
    lcMarkerRef.current = null;
    destMarkerRef.current = null;
  }

  function drawOverlays() {
    const g = gRef.current;
    const map = mapRef.current;
    if (!g || !map || !point) return;

    clearOverlays();

    destMarkerRef.current = new g.maps.Marker({ position: point, map });

    if (!onlyDelivery) {
      lcMarkerRef.current = new g.maps.Marker({ position: LOGISTIC_CENTER, map });

      routeRef.current = new g.maps.Polyline({
        path: [LOGISTIC_CENTER, point],
        strokeColor: "#0ea5e9",
        strokeOpacity: 1,
        strokeWeight: 4,
        icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 }, offset: "0", repeat: "14px" }],
        map,
      });

      const bounds = new g.maps.LatLngBounds();
      bounds.extend(new g.maps.LatLng(LOGISTIC_CENTER.lat, LOGISTIC_CENTER.lng));
      bounds.extend(new g.maps.LatLng(point.lat, point.lng));
      map.fitBounds(bounds);
    } else {
      map.setCenter(point);
      map.setZoom(14);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="5xl">
          <Dialog.Header>
            <Dialog.Title>Delivery location</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            {point ? (
              <Box
                ref={boxRef}
                h="420px"
                w="100%"
                borderRadius="md"
                overflow="hidden"
                bg="gray.50"
                key={`${open}-${onlyDelivery}-${point.lat}-${point.lng}`}
              />
            ) : (
              <Text>No delivery location available for this order.</Text>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            <Button onClick={onClose}>Close</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
