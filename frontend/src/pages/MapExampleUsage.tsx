"use client";

import { useState } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import RouteLocationDialog, {
  type PointValue,
  type TravelMode,
} from "@/components/common/RouteLocationPicker";
import MapPickerDialog from "@/components/common/SingleLocationPicker";

export default function MapUsageExamples() {
  // Editable pickers (your existing demos)
  const [openPoint, setOpenPoint] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<PointValue | null>(null);

  const [openRoute, setOpenRoute] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<{
    origin: PointValue;
    destination: PointValue;
    travelMode: TravelMode;
    distanceText?: string;
    durationText?: string;
  } | null>(null);

  // View-only demos
  const [openPointView, setOpenPointView] = useState(false);
  const [openRouteView, setOpenRouteView] = useState(false);

  return (
    <Flex direction="column" gap={10} p={6}>
      {/* 1) Single Point Picker (editable) */}
      <Box>
        <Text fontSize="lg" fontWeight="bold">🧭 Example 1: Single Point Picker</Text>
        <Text fontSize="sm" color="gray.600">
          Pick a single location using <code>MapPickerDialog</code>
        </Text>
        <Button mt={3} colorPalette="blue" onClick={() => setOpenPoint(true)}>
          Pick a Location
        </Button>

        {selectedPoint && (
          <Box mt={3} fontSize="sm">
            <Text><strong>Address:</strong> {selectedPoint.address}</Text>
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
          // NEW: custom label/title for the single marker
          pointMarkerLabel="H"
          pointMarkerTitle="Home"
          // (optional) initial:
          // initial={{ lat: 32.0853, lng: 34.7818, address: "Tel Aviv-Yafo, Israel" }}
        />
      </Box>

      {/* 2) Route Picker (editable) */}
      <Box>
        <Text fontSize="lg" fontWeight="bold">🚗 Example 2: Route (Two Points)</Text>
        <Text fontSize="sm" color="gray.600">
          Show a route between two addresses using <code>RouteLocationDialog</code>
        </Text>
        <Button mt={3} colorPalette="teal" onClick={() => setOpenRoute(true)}>
          Plan a Route
        </Button>

        {selectedRoute && (
          <Box mt={3} fontSize="sm">
            <Text><strong>Origin:</strong> {selectedRoute.origin.address}</Text>
            <Text><strong>Destination:</strong> {selectedRoute.destination.address}</Text>
            <Text><strong>Travel Mode:</strong> {selectedRoute.travelMode}</Text>
            <Text><strong>Distance:</strong> {selectedRoute.distanceText ?? "?"}</Text>
            <Text><strong>Duration:</strong> {selectedRoute.durationText ?? "?"}</Text>
          </Box>
        )}

        <RouteLocationDialog
          open={openRoute}
          onClose={() => setOpenRoute(false)}
          mode="route"
          initialTravelMode="DRIVING"
          // NEW: custom labels/titles
          markerLabels={{ origin: "H", destination: "LG" }}
          markerTitles={{ origin: "Home", destination: "Logistics Hub" }}
          // (optional) set initial endpoints:
          // initialOrigin={{ lat: 32.0853, lng: 34.7818, address: "Tel Aviv-Yafo, Israel" }}
          // initialDestination={{ lat: 31.7683, lng: 35.2137, address: "Jerusalem, Israel" }}
          onConfirm={(v) => {
            setSelectedRoute(v);
            setOpenRoute(false);
          }}
        />
      </Box>

      {/* 3) View-Only Single Location */}
      <Box>
        <Text fontSize="lg" fontWeight="bold">📍 Example 3: View-Only Single Location</Text>
        <Text fontSize="sm" color="gray.600">Just display one location in <code>view</code> mode.</Text>
        <Button mt={3} colorPalette="purple" onClick={() => setOpenPointView(true)}>
          View Location
        </Button>

        <RouteLocationDialog
          open={openPointView}
          onClose={() => setOpenPointView(false)}
          mode="point"
          viewMode="view"
          countries="IL"
          initialPoint={{
            lat: 32.0853,
            lng: 34.7818,
            address: "Tel Aviv-Yafo, Israel",
          }}
          // You can still show a label/title even in view-only:
          markerLabels={{ point: "H" }}
          markerTitles={{ point: "Home" }}
        />
      </Box>

      {/* 4) View-Only Route */}
      <Box>
        <Text fontSize="lg" fontWeight="bold">🗺️ Example 4: View-Only Route</Text>
        <Text fontSize="sm" color="gray.600">
          Display a pre-defined route (no editing allowed).
        </Text>
        <Button mt={3} colorPalette="orange" onClick={() => setOpenRouteView(true)}>
          View Route
        </Button>

        <RouteLocationDialog
          open={openRouteView}
          onClose={() => setOpenRouteView(false)}
          mode="route"
          viewMode="view"
          initialTravelMode="DRIVING"
          initialOrigin={{ lat: 32.0853, lng: 34.7818, address: "Tel Aviv-Yafo, Israel" }}
          initialDestination={{ lat: 31.7683, lng: 35.2137, address: "Jerusalem, Israel" }}
          // NEW: labels/titles in view-only as well
          markerLabels={{ origin: "H", destination: "LG" }}
          markerTitles={{ origin: "Home", destination: "Logistics Hub" }}
        />
      </Box>
    </Flex>
  );
}
