
// src/components/ui/ShiftPicker.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Field,
  NativeSelectRoot,
  NativeSelectField,
  Spinner,
  HStack,
  Badge,
} from "@chakra-ui/react";
import type { ShiftCode } from "@/types/market";
import type { ShiftOption } from "@/types/market";
import { fetchShiftOptionsByLC, fetchShiftsForLocation } from "@/api/market";

type ShiftPickerProps = {
  locationId?: string;
  logisticCenterId?: string;
  value?: ShiftCode;
  onChange: (v: ShiftCode | undefined) => void;
  placeholder?: string;
  /** Optional preloaded options; if provided we won't fetch. */
  options?: ShiftOption[];
};

export default function ShiftPicker({
  locationId,
  logisticCenterId,
  value,
  onChange,
  placeholder = "Select a shift",
  options,
}: ShiftPickerProps) {
  const [opts, setOpts] = useState<ShiftOption[]>([]);
  const [loading, setLoading] = useState(false);

  const disabled = !locationId;

  useEffect(() => {
    // If options are passed from parent (e.g., resolved by backend), just use them.
    if (options) {
      setOpts(options);
      // If currently selected value is not in the provided list, clear it.
      if (value && !options.some((o) => o.code === value)) onChange(undefined);
      return;
    }

    // Otherwise fetch based on LC (preferred) or location as a fallback.
    if (!locationId) {
      setOpts([]);
      if (value) onChange(undefined);
      return;
    }

    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const rows = logisticCenterId
          ? await fetchShiftOptionsByLC(logisticCenterId)
          : await fetchShiftsForLocation(locationId);

        if (!mounted) return;
        setOpts(rows ?? []);
        if (value && !rows.some((r) => r.code === value)) onChange(undefined);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, logisticCenterId, options]);

  const placeholderText = useMemo(() => {
    if (!locationId) return "Pick delivery location first";
    return placeholder;
  }, [locationId, placeholder]);

  return (
    <Field.Root>
      <Field.Label htmlFor="shift-select">Delivery shift</Field.Label>
      <HStack gap="3" align="center">
        <NativeSelectRoot disabled={disabled || loading}>
          <NativeSelectField
            id="shift-select"
            value={value ?? ""}
            onChange={(e) =>
              onChange((e.target.value || undefined) as ShiftCode | undefined)
            }
          >
            <option value="">{placeholderText}</option>
            {opts.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </NativeSelectField>
        </NativeSelectRoot>

        {loading && <Spinner size="sm" />}
        {!loading && value && opts.find((o) => o.code === value)?.isOpenNow && (
          <Badge colorPalette="green" variant="subtle">
            Open now
          </Badge>
        )}
      </HStack>
      <Field.HelperText>
        {!locationId
          ? "Choose an address to see available shifts."
          : "Pick a shift to see stock for that window."}
      </Field.HelperText>
    </Field.Root>
  );
}


