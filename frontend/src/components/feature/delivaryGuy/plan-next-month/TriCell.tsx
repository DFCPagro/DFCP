import { Badge } from "@chakra-ui/react";
import type { ShiftState } from "@/store/scheduleStore";
import { SHIFT_STATE } from "@/store/scheduleStore";
import { ACTIVE_COLOR } from "./constants";

/** Tri-state chip (Off → On → Standby). */
export default function TriCell({
  value,
  onChange,
}: {
  value: ShiftState;
  onChange: (next: ShiftState) => void;
}) {
  const isOn = value === SHIFT_STATE.ON;
  const isS = value === SHIFT_STATE.STANDBY;

  return (
    <Badge
      as="button"
      variant={isOn ? "solid" : "outline"}
      colorPalette={isOn || isS ? ACTIVE_COLOR : "gray"}
      borderStyle={isS ? "dashed" : undefined}
      onClick={() =>
        onChange(
          value === SHIFT_STATE.OFF
            ? SHIFT_STATE.ON
            : value === SHIFT_STATE.ON
            ? SHIFT_STATE.STANDBY
            : SHIFT_STATE.OFF
        )
      }
      aria-label={isOn ? "On" : isS ? "Standby" : "Off"}
    >
      {isOn ? "On" : isS ? "S" : "Off"}
    </Badge>
  );
}
