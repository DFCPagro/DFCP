"use client";

// Backward-compatible wrapper: delegates to RouteLocationDialog in "point" mode.
import RouteLocationDialog, {
  type PointValue as MapPickerValue,
} from "@/components/common/RouteLocationPicker";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (v: MapPickerValue) => void;
  initial?: { lat: number; lng: number; address?: string };
  countries?: string;
};

export default function MapPickerDialog({ open, onClose, onConfirm, initial, countries }: Props) {
  return (
    <RouteLocationDialog
      open={open}
      onClose={onClose}
      mode="point"
      viewMode="edit"
      countries={countries}
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
