import {
  Drawer,
  HStack,
  VStack,
  Button,
  Badge,
  Text,
  Separator,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  SHIFTS,
  SHIFT_STATE,
  getShiftState,
  setShiftState,
} from "@/store/scheduleStore";
import { useRef } from "react";
import { useScheduleToasts } from "@/helpers/toaster";
const ACTIVE_COLOR = "green" as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  mask: number; // current day mask
  onChange: (nextMask: number) => void; // push updated mask back to grid
  onQuickSetTwo?: () => void; // morning+afternoon = ON
  onClear?: () => void;
  onApplyToWeekday?: () => void; // apply this day’s mask to same weekday in month
  onApplyToEndOfMonth?: () => void; // repeat this day’s mask to month end
  clipboard?: number | null; // for copy/paste (managed by parent)
  onCopy?: () => void;
  onPaste?: () => void;
};

export function DayEditorDrawer({
  open,
  onOpenChange,
  date,
  mask,
  onChange,
  onQuickSetTwo,
  onClear,
  onApplyToWeekday,
  onApplyToEndOfMonth,
  clipboard,
  onCopy,
  onPaste,
}: Props) {
  const T = useScheduleToasts();
  const primaryRef = useRef<HTMLButtonElement>(null);

  if (!date) return null;

  const cycle = (st: number) =>
    st === SHIFT_STATE.OFF
      ? SHIFT_STATE.ON
      : st === SHIFT_STATE.ON
        ? SHIFT_STATE.STANDBY
        : SHIFT_STATE.OFF;

  const toggleShiftTri = (si: number) => {
    const cur = getShiftState(mask, si);
    // limit to max 2 picks (ON or STANDBY both count)
    const pickedBefore = SHIFTS.reduce(
      (acc, _, i) => acc + (getShiftState(mask, i) !== SHIFT_STATE.OFF ? 1 : 0),
      0
    );

    const next = cycle(cur);
    const delta =
      (cur === SHIFT_STATE.OFF && next !== SHIFT_STATE.OFF ? +1 : 0) +
      (cur !== SHIFT_STATE.OFF && next === SHIFT_STATE.OFF ? -1 : 0);

    if (pickedBefore + delta > 2) {
      T.maxTwo();
      return;
    }
    const newMask = setShiftState(mask, si, next);
    onChange(newMask);
  };

  const label = (st: number) =>
    st === SHIFT_STATE.ON
      ? "On"
      : st === SHIFT_STATE.STANDBY
        ? "Standby"
        : "Off";

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      placement="bottom"
      size={{ base: "md", md: "sm" }}
      initialFocusEl={() => primaryRef.current!}
      trapFocus
      preventScroll
      closeOnInteractOutside={false}
    >
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content roundedTop="2xl" pb={2}>
          <Drawer.Header>
            <VStack align="start" gap={1}>
              <Drawer.Title>
                Edit —{" "}
                {date.toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </Drawer.Title>
              <Text color="gray.600" fontSize="sm">
                Tap a chip to cycle: Off → On → Standby (max 2 per day)
              </Text>
            </VStack>
          </Drawer.Header>

          <Drawer.Body>
            <VStack align="stretch" gap={4}>
              {/* shifts row(s) */}
              <HStack wrap="wrap" gap={2}>
                {SHIFTS.map((s, si) => {
                  const st = getShiftState(mask, si);
                  const isOn = st === SHIFT_STATE.ON;
                  const isS = st === SHIFT_STATE.STANDBY;

                  return (
                    <Tooltip key={s.name} content={`${s.name} — ${label(st)}`}>
                      <Badge
                        as="button"
                        onClick={() => toggleShiftTri(si)}
                        variant={isOn ? "solid" : "outline"}
                        colorPalette={isOn || isS ? ACTIVE_COLOR : "gray"} // ← single palette
                        borderStyle={isS ? "dashed" : undefined} // dashed outline for Standby
                        aria-pressed={st !== SHIFT_STATE.OFF}
                      >
                        {s.name} {isS ? "·S" : isOn ? "·On" : ""}
                      </Badge>
                    </Tooltip>
                  );
                })}
              </HStack>

              <Separator />

              {/* quick actions */}
              <VStack align="stretch" gap={3}>
                <Text fontWeight="semibold">Quick actions</Text>
                <HStack wrap="wrap" gap={2}>
                  <Button
                    ref={primaryRef}
                    size="sm"
                    onClick={() => {
                      onQuickSetTwo?.();
                      T.setTwo();
                    }}
                  >
                    Morning + Afternoon On
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const prev = mask;
                      onClear?.();
                      T.dayCleared(() => onChange(prev));
                    }}
                  >
                    Clear day
                  </Button>
                </HStack>
              </VStack>

              {/* copy / paste */}
              <VStack align="stretch" gap={2}>
                <Text fontWeight="semibold">Copy & apply</Text>
                <HStack wrap="wrap" gap={2}>
                  <Button size="sm" onClick={onCopy}>
                    Copy this day
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onPaste}
                    disabled={clipboard == null}
                  >
                    Paste to this day
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onApplyToWeekday}>
                    Apply to same weekday
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onApplyToEndOfMonth}
                  >
                    Repeat to end of month
                  </Button>
                </HStack>
                <Text fontSize="xs" color="gray.600">
                  “Same weekday” = all{" "}
                  {date.toLocaleDateString(undefined, { weekday: "long" })}s in
                  this month.
                </Text>
              </VStack>
            </VStack>
          </Drawer.Body>

          <Drawer.Footer>
            <HStack w="full" justify="end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </HStack>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
