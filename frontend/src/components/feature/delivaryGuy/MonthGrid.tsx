import { useMemo, useCallback, useState } from "react";
import {
  Card,
  HStack,
  VStack,
  Heading,
  Text,
  Grid,
  GridItem,
  Badge,
  Box,
  Stack,
  Separator,
  IconButton,
  ButtonGroup,
  Button,
  VisuallyHidden,
  Switch,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  SHIFTS,
  monthName,
  SHIFT_STATE,
  getShiftState,
  setShiftState,
  countPicked,
  countOn,
  countStandby,
} from "@/store/scheduleStore";
import type { ShiftState } from "@/store/scheduleStore";
import { useEnsureMonth } from "@/store/selectors";
import { Check, X } from "lucide-react";

const SHIFT_COLORS: Array<"yellow" | "blue" | "purple" | "gray"> = [
  "yellow",
  "blue",
  "purple",
  "gray",
];
const sizeMap = {
  sm: { pad: 2, dateFs: "xs", chipFs: "xs" as const },
  md: { pad: 3, dateFs: "sm", chipFs: "sm" as const },
  lg: { pad: 4, dateFs: "md", chipFs: "sm" as const },
};

type Size = "sm" | "md" | "lg";
type MonthGridProps = {
  year: number;
  month: number;
  days?: number[];
  onDaysChange?: (next: number[]) => void;
  editable?: boolean;
  size?: Size;
  shadeWeekends?: boolean;
  highlightToday?: boolean;
  showLegend?: boolean;
  showTotals?: boolean;
  showAdjacentDays?: boolean;
  compactCountMode?: boolean;
};

const buildCalendarMatrix = (y: number, m1: number) => {
  const first = new Date(y, m1 - 1, 1);
  const startDow = first.getDay();
  const startDate = new Date(y, m1 - 1, 1 - startDow);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const isOutside = d.getMonth() !== m1 - 1 || d.getFullYear() !== y;
    return { date: d, isOutside };
  });
};

export default function MonthGrid({
  year,
  month,
  days: daysProp,
  onDaysChange,
  editable = false,
  size = "md",
  shadeWeekends = true,
  highlightToday = true,
  showLegend = true,
  showTotals = true,
  showAdjacentDays = true,
  compactCountMode: compactCountModeProp = false,
}: MonthGridProps) {
  const ensureMonth = useEnsureMonth();
  const sch = useMemo(
    () => ensureMonth(year, month),
    [ensureMonth, year, month]
  );
  const days = daysProp ?? sch.days;

  const [compactCountMode, setCompactCountMode] =
    useState(compactCountModeProp);
  const [showOutside, setShowOutside] = useState(showAdjacentDays);
  const [weekendShade, setWeekendShade] = useState(shadeWeekends);

  const calendar = useMemo(
    () => buildCalendarMatrix(year, month),
    [year, month]
  );
  const today = new Date();
  const sameMonth =
    highlightToday &&
    today.getFullYear() === year &&
    today.getMonth() + 1 === month;
  const s = sizeMap[size];

  const cycle = (state: number): ShiftState =>
    state === SHIFT_STATE.OFF
      ? SHIFT_STATE.ON
      : state === SHIFT_STATE.ON
        ? SHIFT_STATE.STANDBY
        : SHIFT_STATE.OFF;

  const updateDay = (dayIdx: number, newMask: number) => {
    if (!editable || !onDaysChange) return;
    const next = days.slice();
    next[dayIdx] = newMask;
    onDaysChange(next);
  };

  const toggleShiftTri = useCallback(
    (dayIdx: number, shiftIdx: number) => {
      if (!editable || !onDaysChange) return;
      const curMask = days[dayIdx] || 0;
      const curState = getShiftState(curMask, shiftIdx);
      const nextState = cycle(curState);

      // enforce max 2 picks (On+Standby) per day
      const curPicked = countPicked(curMask);
      const nextPicked =
        curPicked +
        (curState === SHIFT_STATE.OFF && nextState !== SHIFT_STATE.OFF
          ? 1
          : 0) -
        (curState !== SHIFT_STATE.OFF && nextState === SHIFT_STATE.OFF ? 1 : 0);

      if (nextPicked > 2) {
        // disallow – subtle feedback could be added (toast / shake)
        return;
      }

      const newMask = setShiftState(curMask, shiftIdx, nextState);
      updateDay(dayIdx, newMask);
    },
    [days, editable, onDaysChange]
  );

  const setDayMask = useCallback(
    (dayIdx: number, mask: number) => updateDay(dayIdx, mask),
    []
  );

  const bulkSetShift = useCallback(
    (shiftIdx: number, state: ShiftState) => {
      if (!editable || !onDaysChange) return;
      const next = days.map((m) => {
        const curState = getShiftState(m, shiftIdx);
        if (curState === state) return m;
        // apply only if it doesn't violate the 2-pick rule
        if (state !== SHIFT_STATE.OFF) {
          const picks = countPicked(m);
          const adding = curState === SHIFT_STATE.OFF ? 1 : 0;
          if (picks + adding > 2) return m; // skip this day
        }
        return setShiftState(m, shiftIdx, state);
      });
      onDaysChange(next);
    },
    [days, editable, onDaysChange]
  );

  const totals = useMemo(() => {
    const workingDays = days.reduce(
      (acc, m) => acc + (countPicked(m) > 0 ? 1 : 0),
      0
    );
    const totalOn = days.reduce((acc, m) => acc + countOn(m), 0);
    const totalS = days.reduce((acc, m) => acc + countStandby(m), 0);
    return { workingDays, totalOn, totalS };
  }, [days]);

  const mapCellToMonthIndex = (date: Date) =>
    date.getMonth() === month - 1 && date.getFullYear() === year
      ? date.getDate() - 1
      : -1;

  return (
    <Card.Root>
      <Card.Header>
        <VStack align="stretch" gap={3}>
          <HStack justify="space-between" wrap="wrap" gap={3}>
            <Heading size="md">
              {monthName(month)} {year}
            </Heading>
            <Text color="gray.600" fontSize="sm">
              {editable
                ? "Click a chip to cycle Off → On → Standby (max 2 per day)."
                : "Read-only view"}
            </Text>
          </HStack>

          <Toolbar
            showLegend
            editable={editable}
            onBulkOn={(si) => bulkSetShift(si, SHIFT_STATE.ON)}
            onBulkStandby={(si) => bulkSetShift(si, SHIFT_STATE.STANDBY)}
            onBulkOff={(si) => bulkSetShift(si, SHIFT_STATE.OFF)}
            weekendShade={weekendShade}
            setWeekendShade={setWeekendShade}
            showOutside={showOutside}
            setShowOutside={setShowOutside}
            compact={compactCountMode}
            setCompact={setCompactCountMode}
          />
        </VStack>
      </Card.Header>

      <Card.Body>
        <Grid templateColumns="repeat(7, 1fr)" gap={2}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((h, i) => (
            <GridItem
              key={h}
              rounded="md"
              p={2}
              textAlign="center"
              border="1px"
              borderColor="gray.200"
              fontWeight="semibold"
              bg={weekendShade && (i === 0 || i === 6) ? "gray.50" : undefined}
            >
              {h}
            </GridItem>
          ))}

          {calendar.map(({ date, isOutside }, idx) => {
            const monthIdx = mapCellToMonthIndex(date);
            const inThisMonth = monthIdx >= 0;
            const mask = inThisMonth ? days[monthIdx] || 0 : 0;

            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const isToday =
              sameMonth && inThisMonth && today.getDate() === date.getDate();
            const bgCell = weekendShade && isWeekend ? "gray.50" : "white";
            const muted = isOutside && !showOutside;

            if (muted)
              return (
                <GridItem
                  key={idx}
                  rounded="lg"
                  p={s.pad}
                  border="1px"
                  borderColor="gray.100"
                />
              );

            return (
              <GridItem key={idx} p={0}>
                <Box
                  position="relative"
                  border="1px"
                  borderColor={isToday ? "blue.300" : "gray.200"}
                  rounded="lg"
                  overflow="hidden"
                  bg={bgCell}
                  p={s.pad}
                  aspectRatio={1}
                  _hover={{ boxShadow: "sm" }}
                >
                  {isToday && (
                    <Box
                      position="absolute"
                      inset={0}
                      pointerEvents="none"
                      rounded="lg"
                      boxShadow="0 0 0 2px var(--chakra-colors-blue-300) inset"
                    />
                  )}

                  <HStack
                    justify="space-between"
                    align="start"
                    mb={2}
                    opacity={isOutside ? 0.6 : 1}
                  >
                    <Box
                      fontSize={s.dateFs}
                      color="gray.700"
                      fontWeight="semibold"
                    >
                      {date.getDate()}
                    </Box>
                    {editable && inThisMonth && (
                      <Tooltip
                        content={
                          mask
                            ? "Clear all"
                            : "Set two (Morning & Afternoon) as ON"
                        }
                      >
                        <IconButton
                          aria-label={mask ? "Clear" : "Quick set"}
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            if (mask) {
                              setDayMask(monthIdx, 0);
                            } else {
                              // quick set 2 ON respecting 2-pick rule
                              let m = 0;
                              m = setShiftState(m, 0, SHIFT_STATE.ON); // Morning
                              m = setShiftState(m, 1, SHIFT_STATE.ON); // Afternoon
                              setDayMask(monthIdx, m);
                            }
                          }}
                        >
                          {mask ? <X size={14} /> : <Check size={14} />}
                        </IconButton>
                      </Tooltip>
                    )}
                  </HStack>

                  <Box opacity={isOutside ? 0.6 : 1}>
                    {compactCountMode ? (
                      <CompactCount mask={mask} />
                    ) : (
                      <ShiftChips
                        mask={mask}
                        editable={editable && inThisMonth}
                        onCycle={(si) => toggleShiftTri(monthIdx, si)}
                      />
                    )}
                  </Box>

                  {isOutside && showOutside && (
                    <Box
                      position="absolute"
                      inset={0}
                      pointerEvents="auto"
                      cursor="not-allowed"
                      aria-hidden
                    />
                  )}
                </Box>
              </GridItem>
            );
          })}
        </Grid>
      </Card.Body>

      {showTotals && (
        <Card.Footer>
          <HStack w="full" justify="space-between" wrap="wrap" gap={2}>
            <Text fontSize="sm" color="gray.600">
              <strong>{totals.workingDays}</strong> working days •{" "}
              <strong>{totals.totalOn}</strong> on •{" "}
              <strong>{totals.totalS}</strong> standby
            </Text>
          </HStack>
        </Card.Footer>
      )}
    </Card.Root>
  );
}

/* Toolbar with legend + filters */
function Toolbar({
  showLegend = true,
  editable,
  onBulkOn,
  onBulkStandby,
  onBulkOff,
  weekendShade,
  setWeekendShade,
  showOutside,
  setShowOutside,
  compact,
  setCompact,
}: {
  showLegend?: boolean;
  editable: boolean;
  onBulkOn?: (si: number) => void;
  onBulkStandby?: (si: number) => void;
  onBulkOff?: (si: number) => void;
  weekendShade: boolean;
  setWeekendShade: (v: boolean) => void;
  showOutside: boolean;
  setShowOutside: (v: boolean) => void;
  compact: boolean;
  setCompact: (v: boolean) => void;
}) {
  return (
    <Stack
      direction={{ base: "column", md: "row" }}
      gap={3}
      align="stretch"
      justify="space-between"
    >
      {showLegend && (
        <Stack direction="row" wrap="wrap" gap={2} align="center">
          {SHIFTS.map((s, si) => (
            <Tooltip key={s.name} content={`${s.name}`}>
              <HStack
                as="span"
                gap={2}
                border="1px"
                borderColor="gray.200"
                rounded="full"
                px={2}
                py={1}
                bg="white"
              >
                <Badge variant="solid" colorPalette={SHIFT_COLORS[si]}>
                  {s.name[0]}
                </Badge>
                <Text fontSize="sm">{s.name}</Text>
                {editable && (
                  <HStack gap={1} pl={1}>
                    <IconButton
                      aria-label={`All ${s.name} ON`}
                      size="xs"
                      variant="outline"
                      onClick={() => onBulkOn?.(si)}
                    >
                      <Check size={14} />
                    </IconButton>
                    <IconButton
                      aria-label={`All ${s.name} STANDBY`}
                      size="xs"
                      variant="outline"
                      onClick={() => onBulkStandby?.(si)}
                    >
                      S
                    </IconButton>
                    <IconButton
                      aria-label={`All ${s.name} OFF`}
                      size="xs"
                      variant="outline"
                      onClick={() => onBulkOff?.(si)}
                    >
                      <X size={14} />
                    </IconButton>
                  </HStack>
                )}
              </HStack>
            </Tooltip>
          ))}
        </Stack>
      )}

      <Stack align="end" gap={2} minW={{ md: "320px" }}>
        <Separator />
        <HStack gap={3} wrap="wrap" justify="flex-end">
          <HStack>
            <Text fontSize="sm" color="gray.600">
              Shade weekends
            </Text>
            <Switch.Root
              size="sm"
              colorPalette="blue"
              checked={weekendShade}
              onCheckedChange={(e) => setWeekendShade(e.checked)}
            >
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label srOnly>Toggle weekend shading</Switch.Label>
            </Switch.Root>
          </HStack>

          <HStack>
            <Text fontSize="sm" color="gray.600">
              Show adjacent days
            </Text>
            <Switch.Root
              size="sm"
              colorPalette="blue"
              checked={showOutside}
              onCheckedChange={(e) => setShowOutside(e.checked)}
            >
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label srOnly>Toggle adjacent days</Switch.Label>
            </Switch.Root>
          </HStack>

          <ButtonGroup size="sm" attached variant="outline">
            <Button aria-pressed={!compact} onClick={() => setCompact(false)}>
              Full chips
            </Button>
            <Button aria-pressed={compact} onClick={() => setCompact(true)}>
              Count
            </Button>
          </ButtonGroup>
        </HStack>
      </Stack>
    </Stack>
  );
}

function ShiftChips({
  mask,
  editable,
  onCycle,
}: {
  mask: number;
  editable: boolean;
  onCycle: (si: number) => void;
}) {
  return (
    <HStack gap={1} wrap="wrap">
      {SHIFTS.map((s, si) => {
        const st = getShiftState(mask, si);
        const isOn = st === SHIFT_STATE.ON;
        const isS = st === SHIFT_STATE.STANDBY;

        const badge = (
          <Badge
            variant={isOn ? "solid" : "outline"}
            colorPalette={isOn || isS ? SHIFT_COLORS[si] : "gray"}
            borderStyle={isS ? "dashed" : undefined}
            opacity={st === SHIFT_STATE.OFF ? 0.8 : 1}
            {...(editable
              ? {
                  as: "button",
                  type: "button",
                  onClick: () => onCycle(si),
                  "aria-pressed": st !== SHIFT_STATE.OFF,
                }
              : {})}
          >
            {s.name[0]}
            {isS ? "·S" : ""}
          </Badge>
        );
        return (
          <Tooltip
            key={s.name}
            content={`${s.name} — ${isOn ? "On" : isS ? "Standby" : "Off"}`}
          >
            {badge}
          </Tooltip>
        );
      })}
    </HStack>
  );
}

function CompactCount({ mask }: { mask: number }) {
  const on = countOn(mask);
  const s = countStandby(mask);
  const total = on + s;
  const palette =
    total === 0
      ? "gray"
      : total >= 2
        ? "purple"
        : total === 1
          ? "yellow"
          : "blue";
  return (
    <Badge variant={total ? "solid" : "subtle"} colorPalette={palette}>
      {total ? `${total} (${s}S)` : "Off"}
    </Badge>
  );
}
