import * as React from "react";
import {
  Button,
  Text,
  Grid,
  GridItem,
  Badge,
  Box,
  HStack,
  VStack,
  Table,
  Checkbox,
  Dialog,
} from "@chakra-ui/react";
import {
  SHIFTS,
  bitForShiftIndex,
  daysShort,
  monthName,
  nextMonthOf,
  simpleChipsLabel,
  useScheduleStore,
} from "@/store/scheduleStore";
import { Tooltip } from "@chakra-ui/react";
type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: (payload: { year: number; month: number; days: number[] }) => void; // <- NEW
};

const countMask = (mask: number) =>
  (mask & 8 ? 1 : 0) +
  (mask & 4 ? 1 : 0) +
  (mask & 2 ? 1 : 0) +
  (mask & 1 ? 1 : 0);

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

  // build preview array for step 2
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

  const toggleDay = React.useCallback(
    (idx: number) => {
      setMonthArr((prev) => {
        const copy = [...prev];
        const base = pattern[dayMeta[idx].dow] || 0;
        copy[idx] = copy[idx] ? 0 : base;
        return copy;
      });
    },
    [pattern, dayMeta]
  );

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

  const totals = React.useMemo(() => {
    const daysActive = monthArr.filter((m) => m).length;
    const totalShifts = monthArr.reduce((acc, m) => acc + countMask(m), 0);
    return { daysActive, totalShifts };
  }, [monthArr]);

  const handleSave = () => {
    setWeeklyPattern(pattern);
    const payload = { year: y, month: m, days: monthArr };
    saveMonth({ ...payload, createdAt: Date.now() });

    onSaved?.(payload); // notify parent
    setStep(1); // reset internal step for the next open
    // DO NOT call onClose() here if parent handles closing in onSaved
  };

  // reset state when dialog closes
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

  // correct v3 Dialog onOpenChange contract
  const handleOpenChange = (details: { open: boolean }) => {
    if (!details.open) onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="5xl">
          <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>Plan Next Month</Dialog.Title>
            <Text color="gray.600" mt={1}>
              {step === 1
                ? "Step 1 of 2 — Pick weekly pattern (shifts per weekday)"
                : "Step 2 of 2 — Uncheck days you don’t want to work"}
            </Text>
          </Dialog.Header>

          <Dialog.Body>
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
                          const checked =
                            (pattern[dow] & bitForShiftIndex(si)) !== 0;
                          return (
                            <Table.Cell key={`${si}-${dow}`} textAlign="center">
                              <Checkbox.Root
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const isChecked =
                                    (typeof v === "boolean"
                                      ? v
                                      : v?.checked) === true;
                                  const next = [...pattern];
                                  if (isChecked)
                                    next[dow] =
                                      next[dow] | bitForShiftIndex(si);
                                  else
                                    next[dow] =
                                      next[dow] & ~bitForShiftIndex(si);
                                  setPattern(next);
                                }}
                                aria-label={`${s.name} on ${daysShort[dow]}`}
                              >
                                <Checkbox.Control>
                                  <Checkbox.Indicator />
                                </Checkbox.Control>
                              </Checkbox.Root>
                            </Table.Cell>
                          );
                        })}
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </VStack>
            )}

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
                    Click a day to toggle work on/off. Weekday shifts are
                    restored when toggling back on.
                  </Text>
                </HStack>

                <Text fontWeight="semibold" mt={1}>
                  {monthName(m)} {y}
                </Text>

                <Box maxH="60vh" overflow="auto" pr={1}>
                  <Grid templateColumns="repeat(7, 1fr)" gap={2}>
                    {daysShort.map((h) => (
                      <GridItem
                        key={h}
                        bg="gray.50"
                        border="1px"
                        borderColor="gray.200"
                        rounded="md"
                        p={2}
                        textAlign="center"
                        fontWeight="bold"
                      >
                        {h}
                      </GridItem>
                    ))}

                    {(() => {
                      const firstDow = new Date(y, m - 1, 1).getDay();
                      const blanks = Array.from(
                        { length: firstDow },
                        (_, i) => (
                          <GridItem
                            key={`b${i}`}
                            rounded="md"
                            p={2}
                            border="1px"
                            borderColor="gray.100"
                          />
                        )
                      );
                      const cells = monthArr.map((mask, idx) => {
                        const pressed = !!mask;
                        // button semantics for keyboard + a11y
                        return (
                          <GridItem key={idx} p={0}>
                            <Box
                              as="button"
                              onClick={() => toggleDay(idx)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleDay(idx);
                                }
                              }}
                              aria-pressed={pressed}
                              aria-label={`Toggle ${dayMeta[idx].label}`}
                              w="100%"
                              textAlign="left"
                              border="1px"
                              borderColor="gray.200"
                              rounded="md"
                              p={2}
                              _hover={{ bg: "gray.50" }}
                            >
                              <Box
                                textAlign="right"
                                fontSize="sm"
                                color="gray.600"
                              >
                                {idx + 1}
                              </Box>
                              <Badge
                                mt={1}
                                variant={pressed ? "solid" : "subtle"}
                                colorPalette={pressed ? "green" : "gray"}
                              >
                                {simpleChipsLabel(mask)}
                              </Badge>
                            </Box>
                          </GridItem>
                        );
                      });
                      return [...blanks, ...cells];
                    })()}
                  </Grid>
                </Box>
              </VStack>
            )}
          </Dialog.Body>

          <Dialog.Footer justifyContent="space-between">
            {step === 2 ? (
              <Text fontSize="sm" color="gray.600">
                <strong>{totals.daysActive}</strong> working days •{" "}
                <strong>{totals.totalShifts}</strong> total shifts
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
                  {totals.daysActive === 0 && (
                    <Tooltip.Content>
                      You can still save an all-off month
                    </Tooltip.Content>
                  )}
                </Tooltip.Root>
              </HStack>
            )}
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
