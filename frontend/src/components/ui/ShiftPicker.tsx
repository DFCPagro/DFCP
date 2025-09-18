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
import {
  fetchShiftOptionsByLC,
  type ShiftOptionDTO,
  // ⬇️ add this import so we can fallback
  fetchShiftsForLocation,
} from "@/api/market";

type Props = {
  locationId?: string;
  value?: ShiftCode;
  onChange: (v: ShiftCode | undefined) => void;
  logisticCenterId?: string; // optional
  placeholder?: string;
};

export default function ShiftPicker({
  locationId,
  logisticCenterId,
  value,
  onChange,
  placeholder = "Select a shift",
}: Props) {
  const [opts, setOpts] = useState<ShiftOptionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const disabled = !locationId; // ✅ allow fallback even if LC not ready

  useEffect(() => {
    if (!locationId) {
      setOpts([]);
      onChange(undefined);
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // ✅ Prefer LC, fallback to location-based API
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
  }, [locationId, logisticCenterId]);

  const placeholderText = useMemo(() => {
    if (!locationId) return "Pick delivery location first";
    return placeholder; // ✅ no “resolving” message
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
