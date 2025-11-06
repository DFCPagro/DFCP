"use client";

// Backward-compatible wrapper: delegates to RouteLocationDialog in "point" mode.
import RouteLocationDialog, {
  type PointValue as MapPickerValue,
  type TypedPin,
} from "@/components/common/RouteLocationPicker";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (v: MapPickerValue) => void;
  initial?: { lat: number; lng: number; address?: string };
  countries?: string;

  /** NEW: forward typed-overlay pins to the underlying dialog */
  homeMarker?: TypedPin;
  businessMarker?: TypedPin;

  /** Optional: view size passthrough (defaults to "lg" like the dialog) */
  size?: "sm" | "md" | "lg";
  /** Optional: edit/view passthrough (defaults to "edit") */
  viewMode?: "edit" | "view";
};

export default function MapPickerDialog({
  open,
  onClose,
  onConfirm,
  initial,
  countries,
  homeMarker,
  businessMarker,
  size,
  viewMode = "edit",
}: Props) {
  return (
    <RouteLocationDialog
      open={open}
      onClose={onClose}
      mode="point"
      viewMode={viewMode}
      size={size}
      countries={countries}
      /** forward the typed pins */
      homeMarker={homeMarker}
      businessMarker={businessMarker}
      initialPoint={
        initial
          ? { address: initial.address ?? "", lat: initial.lat, lng: initial.lng }
          : undefined
      }
      onConfirm={onConfirm}
    />
  );
}

export type { MapPickerValue };
