import { useEffect, useMemo, useState } from "react";
import { Field, HStack, Spinner, Text } from "@chakra-ui/react";
import type { ShiftCode, ShiftOption } from "@/types/market";
import { fetchShiftsForLocation } from "@/api/market";

type Props = {
  locationId?: string;
  value?: ShiftCode;
  onChange: (v: ShiftCode | undefined) => void;
};

export default function ShiftPicker({ locationId, value, onChange }: Props) {
  const [options, setOptions] = useState<ShiftOption[]>([]);
  const [loading, setLoading] = useState(false);

  // reload whenever location changes
  useEffect(() => {
    if (!locationId) {
      setOptions([]);
      onChange(undefined);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchShiftsForLocation(locationId);
        if (!cancelled) setOptions(res);
        if (!cancelled && value && !res.some((o) => o.code === value)) onChange(undefined);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const placeholder = useMemo(
    () =>
      !locationId
        ? "Pick a location first"
        : loading
        ? "Loading shifts..."
        : "Select a shift",
    [locationId, loading]
  );

  const selectId = "shift-select";

  return (
    <Field.Root>
      <Field.Label htmlFor={selectId}>Delivery shift</Field.Label>
      <HStack align="center" gap={2}>
        <select
          id={selectId}
          value={value ?? ""}
          onChange={(e) => onChange((e.target.value || undefined) as ShiftCode | undefined)}
          disabled={!locationId || loading}
          aria-label="Delivery shift"
          style={{
            padding: "8px 10px",
            borderRadius: "8px",
            border: "1px solid var(--chakra-colors-gray-300)",
            minWidth: 240,
            background: "var(--chakra-colors-white)",
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.label}
            </option>
          ))}
        </select>

        {loading && <Spinner size="sm" />}
        {!loading && locationId && options.length === 0 && (
          <Text fontSize="sm" color="gray.600">
            No shifts for this location
          </Text>
        )}
      </HStack>
    </Field.Root>
  );
}
