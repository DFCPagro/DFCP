import * as React from "react";
import {
  Button,
  Text,
  Badge,
  Box,
  HStack,
  VStack,
  Table,
  Dialog,
  Tooltip, // using Chakra v3 compound: <Tooltip.Root>... if desired
} from "@chakra-ui/react";
import {
  SHIFTS,
  daysShort,
  monthName,
  nextMonthOf,
  useScheduleStore,
} from "@/store/scheduleStore";
import type { ShiftState } from "@/store/scheduleStore";
import {
  SHIFT_STATE,
  getShiftState,
  setShiftState,
  countPicked,
} from "@/store/scheduleStore";
import MonthGrid from "./MonthGrid";
import { X } from "lucide-react";
import { StyledIconButton } from "@/components/ui/IconButton";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: (payload: { year: number; month: number; days: number[] }) => void;
};

/** Tri-state chip used in Step 1 table cells (cycles Off → On → Standby). */
function TriCell({
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
      colorPalette={isOn || isS ? "blue" : "gray"}
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

export default function PlanNextMonthDialog({ open, onClose, onSaved }: Props) {
  const weeklyPattern = useScheduleStore((s) => s.weeklyPattern);
  const setWeeklyPattern = useScheduleStore((s) => s.setWeeklyPattern);
  const saveMonth = useScheduleStore((s) => s.saveMonth);

  // compute next month once
  const today = React.useMemo(() => new Date(), []);
  const { y, m } = React.useMemo(() => nextMonthOf(today), [today]);

  // steps
  const [step, setStep] = React.useState<1 | 2>(1);
  const [pattern, setPattern] = React.useState<number[]>(() =>
    weeklyPattern?.length === 7 ? weeklyPattern : new Array(7).fill(0)
  );
  const [monthArr, setMonthArr] = React.useState<number[]>([]);

  // build preview array for step 2 from weekly pattern
  React.useEffect(() => {
    if (step !== 2) return;
    const len = new Date(y, m, 0).getDate();
    const arr = Array.from({ length: len }, (_, i) => {
      const dow = new Date(y, m - 1, i + 1).getDay();
      return pattern[dow] || 0;
    });
    setMonthArr(arr);
  }, [step, y, m, pattern]);

  const dayMeta = React.useMemo(() => {
    // cache weekday for each index to avoid repeated new Date() per render
    const len = new Date(y, m, 0).getDate();
    return Array.from({ length: len }, (_, i) => ({
      dow: new Date(y, m - 1, i + 1).getDay(),
      label: `${monthName(m)} ${i + 1}`,
    }));
  }, [y, m]);

  const setAll = React.useCallback(
    (on: boolean) => {
      setMonthArr((prev) =>
        prev.map((_, i) => (on ? pattern[dayMeta[i].dow] || 0 : 0))
      );
    },
    [pattern, dayMeta]
  );

  const toggleWeekends = React.useCallback(
    (on: boolean) => {
      setMonthArr((prev) =>
        prev.map((cur, i) => {
          const dow = dayMeta[i].dow;
          if (dow === 0 || dow === 6) return on ? pattern[dow] || 0 : 0;
          return cur;
        })
      );
    },
    [pattern, dayMeta]
  );

  // Tri-state aware totals: "picks" = On + Standby
  const totals = React.useMemo(() => {
    const daysActive = monthArr.filter((m) => countPicked(m) > 0).length;
    const totalPicks = monthArr.reduce((acc, m) => acc + countPicked(m), 0);
    return { daysActive, totalPicks };
  }, [monthArr]);

  const handleSave = () => {
    setWeeklyPattern(pattern);
    const payload = { year: y, month: m, days: monthArr };
    saveMonth({ ...payload, createdAt: Date.now() });

    onSaved?.(payload); // notify parent
    setStep(1); // reset internal step for the next open
  };

  // reset internal state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setStep(1);
      setPattern(
        weeklyPattern?.length === 7 ? weeklyPattern : new Array(7).fill(0)
      );
      setMonthArr([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      closeOnInteractOutside={false}
      closeOnEscape={false}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="5xl" position="relative">
          <Dialog.CloseTrigger asChild>
            <StyledIconButton
              aria-label="Close dialog"
              variant="ghost"
              size="sm"
            >
              <X />
            </StyledIconButton>
          </Dialog.CloseTrigger>

          <Dialog.Header>
            <Dialog.Title>Plan Next Month</Dialog.Title>
            <Text color="gray.600" mt={1}>
              {step === 1
                ? "Step 1 of 2 — Pick weekly pattern (max 2 picks per weekday)"
                : "Step 2 of 2 — Review month (cycle chips Off → On → Standby; max 2 per day)"}
            </Text>
          </Dialog.Header>

          <Dialog.Body>
            {/* STEP 1: weekly pattern (tri-state per shift per weekday) */}
            {step === 1 && (
              <VStack align="stretch" gap={4}>
                <Table.Root size="sm" variant="line">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Shift / Day</Table.ColumnHeader>
                      {daysShort.map((d) => (
                        <Table.ColumnHeader key={d} textAlign="center">
                          {d}
                        </Table.ColumnHeader>
                      ))}
                    </Table.Row>
                  </Table.Header>

                  <Table.Body>
                    {SHIFTS.map((s, si) => (
                      <Table.Row key={s.name}>
                        <Table.Cell>
                          <VStack align="start" gap={0}>
                            <Text fontWeight="semibold">{s.name}</Text>
                            <Text fontSize="sm" color="gray.600">
                              {s.start} - {s.end}
                            </Text>
                          </VStack>
                        </Table.Cell>

                        {Array.from({ length: 7 }, (_, dow) => {
                          const curMask = pattern[dow] ?? 0;
                          const cur = getShiftState(curMask, si);
                          const pickedCount = countPicked(curMask); // On + Standby
                          return (
                            <Table.Cell key={`${si}-${dow}`} textAlign="center">
                              <TriCell
                                value={cur}
                                onChange={(next) => {
                                  // enforce max 2 picks for that weekday
                                  const wasPicked = cur !== SHIFT_STATE.OFF;
                                  const willPicked = next !== SHIFT_STATE.OFF;
                                  const delta =
                                    (willPicked ? 1 : 0) - (wasPicked ? 1 : 0);
                                  if (pickedCount + delta > 2) return;

                                  const nextMask = setShiftState(
                                    curMask,
                                    si,
                                    next
                                  );
                                  const copy = [...pattern];
                                  copy[dow] = nextMask;
                                  setPattern(copy);
                                }}
                              />
                            </Table.Cell>
                          );
                        })}
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </VStack>
            )}

            {/* STEP 2: month preview/edit (tri-state MonthGrid enforces max 2 per day) */}
            {step === 2 && (
              <VStack align="stretch" gap={3}>
                <HStack gap={2} wrap="wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleWeekends(false)}
                  >
                    Uncheck weekends
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleWeekends(true)}
                  >
                    Check weekends
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAll(true)}
                  >
                    Select all
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAll(false)}
                  >
                    Clear all
                  </Button>
                  <Text fontSize="sm" color="gray.600">
                    Tip: click a chip to cycle Off → On → Standby (max 2 per
                    day).
                  </Text>
                </HStack>

                <MonthGrid
                  year={y}
                  month={m}
                  days={monthArr}
                  editable
                  onDaysChange={setMonthArr}
                />
              </VStack>
            )}
          </Dialog.Body>

          <Dialog.Footer justifyContent="space-between">
            {step === 2 ? (
              <Text fontSize="sm" color="gray.600">
                <strong>{totals.daysActive}</strong> working days •{" "}
                <strong>{totals.totalPicks}</strong> total picks
              </Text>
            ) : (
              <Box />
            )}

            {step === 1 ? (
              <HStack>
                <Button variant="ghost" onClick={() => onClose()}>
                  Cancel
                </Button>
                <Button colorPalette="blue" onClick={() => setStep(2)}>
                  Next
                </Button>
              </HStack>
            ) : (
              <HStack>
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>

                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <Button colorPalette="blue" onClick={handleSave}>
                      Save
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>
                    You can save now. (Limits are enforced while editing.)
                  </Tooltip.Content>
                </Tooltip.Root>
              </HStack>
            )}
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
