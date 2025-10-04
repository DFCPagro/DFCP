"use client";

import { useState } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import LocationRouteDialog, {
  type PointValue,
  type TravelMode,
} from "@/components/common/LocationRouteDialog";
import MapPickerDialog from "@/components/common/MapPickerDialog";

export default function MapUsageExamples() {
  // Example 1 — Single point picker
  const [openPoint, setOpenPoint] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<PointValue | null>(null);

  // Example 2 — Route picker (two points)
  const [openRoute, setOpenRoute] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<{
    origin: PointValue;
    destination: PointValue;
    travelMode: TravelMode;
    distanceText?: string;
    durationText?: string;
  } | null>(null);

  return (
    <Flex direction="column" gap={6} p={6}>
      <Box>
        <Text fontSize="lg" fontWeight="bold">
          🧭 Example 1: Single Point Picker
        </Text>
        <Text fontSize="sm" color="gray.600">
          Pick a single location using <code>MapPickerDialog</code>
        </Text>
        <Button mt={3} colorPalette="blue" onClick={() => setOpenPoint(true)}>
          Pick a Location
        </Button>

        {selectedPoint && (
          <Box mt={3} fontSize="sm">
            <Text>
              <strong>Address:</strong> {selectedPoint.address}
            </Text>
            <Text>
              <strong>Lat:</strong> {selectedPoint.lat.toFixed(6)},{" "}
              <strong>Lng:</strong> {selectedPoint.lng.toFixed(6)}
            </Text>
          </Box>
        )}

        <MapPickerDialog
          open={openPoint}
          onClose={() => setOpenPoint(false)}
          onConfirm={(v) => {
            setSelectedPoint(v);
            setOpenPoint(false);
          }}
          countries="US"
        />
      </Box>

      <Box>
        <Text fontSize="lg" fontWeight="bold">
          🚗 Example 2: Route (Two Points)
        </Text>
        <Text fontSize="sm" color="gray.600">
          Show a route between two addresses using{" "}
          <code>LocationRouteDialog</code>
        </Text>
        <Button mt={3} colorPalette="teal" onClick={() => setOpenRoute(true)}>
          Plan a Route
        </Button>

        {selectedRoute && (
          <Box mt={3} fontSize="sm">
            <Text>
              <strong>Origin:</strong> {selectedRoute.origin.address}
            </Text>
            <Text>
              <strong>Destination:</strong> {selectedRoute.destination.address}
            </Text>
            <Text>
              <strong>Travel Mode:</strong> {selectedRoute.travelMode}
            </Text>
            <Text>
              <strong>Distance:</strong> {selectedRoute.distanceText ?? "?"}
            </Text>
            <Text>
              <strong>Duration:</strong> {selectedRoute.durationText ?? "?"}
            </Text>
          </Box>
        )}

        <LocationRouteDialog
          open={openRoute}
          onClose={() => setOpenRoute(false)}
          mode="route"
          initialTravelMode="DRIVING"
          onConfirm={(v) => {
            setSelectedRoute(v);
            setOpenRoute(false);
          }}
        />
      </Box>
    </Flex>
  );
}
