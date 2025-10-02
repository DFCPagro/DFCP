// src/components/feature/orders/LocationMapModal.tsx
import { useEffect, useRef } from "react";
import { Box, Button, Dialog, Text } from "@chakra-ui/react";
import type { LatLng } from "@/utils/order/orders";
import { loadGoogleMaps } from "@/utils/googleMaps";

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

  const googleRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const lcMarkerRef = useRef<any>(null);
  const routeRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    const waitForVisible = (el: HTMLElement) =>
      new Promise<void>((resolve) => {
        const check = () => {
          if (cancelled) return;
          const visible = el.offsetWidth > 0 && el.offsetHeight > 0;
          if (visible) resolve();
          else requestAnimationFrame(check);
        };
        check();
      });

    const init = async () => {
      if (!open || !boxRef.current) return;

      await waitForVisible(boxRef.current); // ensure dialog laid out

      try {
        const g = await loadGoogleMaps();
        if (cancelled) return;
        googleRef.current = g;

        // clean container if reopening
        boxRef.current.innerHTML = "";

        const center = point
          ? !onlyDelivery
            ? {
                lat: (LOGISTIC_CENTER.lat + point.lat) / 2,
                lng: (LOGISTIC_CENTER.lng + point.lng) / 2,
              }
            : { lat: point.lat, lng: point.lng }
          : LOGISTIC_CENTER;

        mapRef.current = new g.maps.Map(boxRef.current, {
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

        // next frame to ensure tiles render
        requestAnimationFrame(() => g.maps.event.trigger(mapRef.current, "resize"));

        drawOverlays();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Google Maps init error:", err);
      }
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
    const g = googleRef.current;
    const map = mapRef.current;
    if (!g || !map || !point) return;

    clearOverlays();

    destMarkerRef.current = new g.maps.Marker({
      position: { lat: point.lat, lng: point.lng },
      map,
    });

    if (!onlyDelivery) {
      lcMarkerRef.current = new g.maps.Marker({
        position: { lat: LOGISTIC_CENTER.lat, lng: LOGISTIC_CENTER.lng },
        map,
      });

      routeRef.current = new g.maps.Polyline({
        path: [
          { lat: LOGISTIC_CENTER.lat, lng: LOGISTIC_CENTER.lng },
          { lat: point.lat, lng: point.lng },
        ],
        strokeColor: "#0ea5e9",
        strokeOpacity: 1,
        strokeWeight: 4,
        icons: [
          { icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 }, offset: "0", repeat: "14px" },
        ],
        map,
      });

      const bounds = new g.maps.LatLngBounds();
      bounds.extend(new g.maps.LatLng(LOGISTIC_CENTER.lat, LOGISTIC_CENTER.lng));
      bounds.extend(new g.maps.LatLng(point.lat, point.lng));
      map.fitBounds(bounds, 32);
    } else {
      map.setCenter({ lat: point.lat, lng: point.lng });
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
              <Box ref={boxRef} h="420px" w="100%" borderRadius="md" overflow="hidden" />
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
