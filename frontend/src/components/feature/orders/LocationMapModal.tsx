// src/components/orders/LocationMapModal.tsx
import { useEffect, useState } from "react";
import { Box, Button, Dialog, Text } from "@chakra-ui/react";
import type { LatLng } from "@/utils/order/orders";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";

export default function LocationMapModal({
  open,
  onClose,
  point,
}: {
  open: boolean;
  onClose: () => void;
  point?: LatLng;
}) {
  // force re-render when point changes to recenter map
  const [key, setKey] = useState<string>("");
  useEffect(() => {
    if (point) setKey(`${point.lat},${point.lng}`);
  }, [point?.lat, point?.lng]);

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
              <Box h="420px" w="100%" borderRadius="md" overflow="hidden">
                <MapContainer
                  {...({ center: [point.lat, point.lng], zoom: 13 } as any)}
                  style={{ height: "100%", width: "100%" }}
                  key={key}
                >
                  <TileLayer
                    {...({
                      attribution: "© OpenStreetMap contributors",
                      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                    } as any)}
                  />
                  <CircleMarker
                    {...({
                      center: [point.lat, point.lng],
                      radius: 9,
                      pathOptions: { color: "#16a34a" },
                    } as any)}
                  />
                </MapContainer>
              </Box>
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
