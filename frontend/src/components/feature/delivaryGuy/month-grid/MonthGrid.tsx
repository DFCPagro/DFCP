import { useMemo, useCallback, useState } from "react";
import {
  Card,
  HStack,
  Text,
  Grid,
  GridItem,
  useBreakpointValue,
} from "@chakra-ui/react";
import {
  SHIFT_STATE,
  getShiftState,
  setShiftState,
  countPicked,
  countOn,
  countStandby,
} from "@/store/scheduleStore";
import type { ShiftState } from "@/store/scheduleStore";
import { useEnsureMonth } from "@/store/selectors";
import { DayCell } from "./DayCell";
import type { MonthGridProps } from "./types";
import { DayEditorDrawer } from "./DayEditorDrawer";
import { useScheduleToasts } from "@/helpers/toaster";
import HeaderBar from "./HeaderBar"; // keep your lightweight header

const sizeMap = {
  sm: { pad: 2, dateFs: "xs" as const },
  md: { pad: 3, dateFs: "sm" as const },
  lg: { pad: 4, dateFs: "md" as const },
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
  hideBorder = false,
  editable = false,
  size = "md",
  removePadding=false,
  shadeWeekends = true,
  highlightToday = true,
  showTotals = true,
  showAdjacentDays = true,
  density: densityProp = "dots",
  showActions,
  weekdayTemplate,
}: MonthGridProps) {
  const T = useScheduleToasts();
  const ensureMonth = useEnsureMonth();
  const sch = useMemo(() => ensureMonth(year, month), [ensureMonth, year, month]);
  const days = daysProp ?? sch.days;

  const [density, setDensity] = useState(densityProp);
  const [showOutside, setShowOutside] = useState(showAdjacentDays);
  const [weekendShade, setWeekendShade] = useState(shadeWeekends);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDayIdx, setDrawerDayIdx] = useState<number | null>(null);
  const [clipboard, setClipboard] = useState<number | null>(null);

  const openDrawer = (dayIdx: number) => {
    setDrawerDayIdx(dayIdx);
    setDrawerOpen(true);
  };

  const currentMask = drawerDayIdx != null ? days[drawerDayIdx] || 0 : 0;
  const currentDate =
    drawerDayIdx != null ? new Date(year, month - 1, drawerDayIdx + 1) : null;

  const updateDrawerMask = (nextMask: number) => {
    if (drawerDayIdx == null) return;
    updateDay(drawerDayIdx, nextMask);
  };

  const calendar = useMemo(() => buildCalendarMatrix(year, month), [year, month]);
  const today = new Date();
  const sameMonth =
    highlightToday &&
    today.getFullYear() === year &&
    today.getMonth() + 1 === month;
  const s = sizeMap[size];

  // ---------- responsive sizing ----------
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;
  const padEff: number = isMobile ? 1 : s.pad;
  const dateFsEff: "xs" | "sm" | "md" = isMobile ? "xs" : s.dateFs;
  const densityEff = isMobile ? "dots" : density; // compact on phones
  const weekdayLabels = useBreakpointValue({
    base: ["S", "M", "T", "W", "T", "F", "S"],
    md: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  })!;
  const gridGap = useBreakpointValue({ base: 1, md: 2 }) ?? 2;
  const headerP = useBreakpointValue({ base: 1, md: 2 }) ?? 2;
  const headerFs = useBreakpointValue({ base: "xs", md: "sm" }) as "xs" | "sm";

  // ---------- state helpers ----------
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

      const curPicked = countPicked(curMask);
      const nextPicked =
        curPicked +
        (curState === SHIFT_STATE.OFF && nextState !== SHIFT_STATE.OFF ? 1 : 0) -
        (curState !== SHIFT_STATE.OFF && nextState === SHIFT_STATE.OFF ? 1 : 0);

      if (nextPicked > 2) return T.maxTwo();

      const newMask = setShiftState(curMask, shiftIdx, nextState);
      updateDay(dayIdx, newMask);
    },
    [days, editable, onDaysChange]
  );

  const setDayMask = useCallback(
    (dayIdx: number, mask: number) => updateDay(dayIdx, mask),
    []
  );

  const setAll = useCallback(
    (on: boolean) => {
      if (!editable || !onDaysChange) return;

      const prev = days.slice();

      if (!on) {
        onDaysChange(days.map(() => 0));
        T.clearedMonth(() => onDaysChange(prev));
        return;
      }
      if (!weekdayTemplate || weekdayTemplate.length !== 7) {
        T.templateMissing("template");
        return;
      }
      const len = new Date(year, month, 0).getDate();
      const next = Array.from({ length: len }, (_, i) => {
        const dow = new Date(year, month - 1, i + 1).getDay();
        return weekdayTemplate[dow] || 0;
      });
      onDaysChange(next);
      T.appliedTemplate(() => onDaysChange(prev));
    },
    [editable, onDaysChange, weekdayTemplate, year, month, days]
  );

  const toggleWeekends = useCallback(
    (on: boolean) => {
      if (!editable || !onDaysChange) return;
      if (on && (!weekdayTemplate || weekdayTemplate.length !== 7)) {
        T.templateMissing("weekends");
        return;
      }
      const prev = days.slice();
      const next = days.map((cur, i) => {
        const dow = new Date(year, month - 1, i + 1).getDay();
        if (dow !== 0 && dow !== 6) return cur;
        return on ? weekdayTemplate![dow] || 0 : 0;
      });
      onDaysChange(next);
      T.weekends(on, () => onDaysChange(prev));
    },
    [editable, onDaysChange, weekdayTemplate, year, month, days]
  );

  const totals = useMemo(() => {
    const workingDays = days.reduce((acc, m) => acc + (countPicked(m) > 0 ? 1 : 0), 0);
    const totalOn = days.reduce((acc, m) => acc + countOn(m), 0);
    const totalS = days.reduce((acc, m) => acc + countStandby(m), 0);
    return { workingDays, totalOn, totalS };
  }, [days]);

  const mapCellToMonthIndex = (date: Date) =>
    date.getMonth() === month - 1 && date.getFullYear() === year
      ? date.getDate() - 1
      : -1;

  const actionsVisible = typeof showActions === "boolean" ? showActions : editable;

  return (
    <Card.Root border={hideBorder? 0: undefined}>
      <Card.Header px={removePadding? 0: undefined}>
        <HeaderBar
          month={month}
          year={year}
          actionsVisible={actionsVisible}
          editable={editable}
          density={density}
          setDensity={setDensity}
          hasTemplate={!!weekdayTemplate && weekdayTemplate.length === 7}
          weekendShade={weekendShade}
          setWeekendShade={setWeekendShade}
          showOutside={showOutside}
          setShowOutside={setShowOutside}
          onClearAll={() => setAll(false)}
          onSelectAllFromTemplate={() => setAll(true)}
          onCheckWeekends={() => toggleWeekends(true)}
          onUncheckWeekends={() => toggleWeekends(false)}
        />
      </Card.Header>

      <Card.Body px={removePadding? 0: undefined}>
        {/* No scroll: we just scale things down on base */}
        <Grid templateColumns="repeat(7, 1fr)" gap={gridGap} overflowX={"scroll"}>
          {weekdayLabels.map((h, i) => (
            <GridItem
              key={i}
              rounded="md"
              p={headerP}
              textAlign="center"
              border="1px"
              borderColor="gray.200"
              fontWeight="semibold"
              fontSize={headerFs}
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
              sameMonth && inThisMonth && date.getDate() === new Date().getDate();

            if (isOutside && !showOutside) {
              return (
                <GridItem
                  key={idx}
                  rounded="lg"
                  p={padEff}
                  border="1px"
                  borderColor="gray.100"
                />
              );
            }

            return (
              <GridItem key={idx} p={0}>
                <DayCell
                  date={date}
                  isToday={!!isToday}
                  isOutside={isOutside}
                  isWeekend={isWeekend}
                  mask={mask}
                  inThisMonth={inThisMonth}
                  editable={editable}
                  density={densityEff}
                  weekendShade={weekendShade}
                  showOutside={showOutside}
                  pad={padEff}
                  dateFs={dateFsEff}
                  onQuickClear={() => setDayMask(monthIdx, 0)}
                  onQuickSetTwo={() => {
                    let m = 0;
                    m = setShiftState(m, 0, SHIFT_STATE.ON);
                    m = setShiftState(m, 1, SHIFT_STATE.ON);
                    setDayMask(monthIdx, m);
                  }}
                  onOpenDrawer={
                    inThisMonth && editable
                      ? () => openDrawer(monthIdx)
                      : () => T.outsideDay()
                  }
                  onCycle={(si) => toggleShiftTri(monthIdx, si)}
                />
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

      <DayEditorDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        date={currentDate}
        mask={currentMask}
        onChange={updateDrawerMask}
        onQuickSetTwo={() => {
          if (drawerDayIdx == null) return;
          let m = 0;
          m = setShiftState(m, 0, SHIFT_STATE.ON);
          m = setShiftState(m, 1, SHIFT_STATE.ON);
          updateDrawerMask(m);
        }}
        onClear={() => updateDrawerMask(0)}
        onApplyToWeekday={() => {
          if (drawerDayIdx == null) return;
          const prev = days.slice();
          const date = new Date(year, month - 1, drawerDayIdx + 1);
          const targetDow = date.getDay();
          const len = new Date(year, month, 0).getDate();
          const next = days.slice(0, len);
          for (let i = 0; i < len; i++) {
            const d = new Date(year, month - 1, i + 1);
            if (d.getDay() === targetDow) next[i] = currentMask;
          }
          onDaysChange?.(next);
          T.appliedSameWeekday(
            date.toLocaleDateString(undefined, { weekday: "long" }),
            () => onDaysChange?.(prev)
          );
        }}
        onApplyToEndOfMonth={() => {
          if (drawerDayIdx == null) return;
          const prev = days.slice();
          const len = new Date(year, month, 0).getDate();
          const next = days.slice(0, len);
          for (let i = drawerDayIdx; i < len; i++) next[i] = currentMask;
          onDaysChange?.(next);
          T.repeatedToEnd(() => onDaysChange?.(prev));
        }}
        clipboard={clipboard}
        onCopy={() => setClipboard(currentMask)}
        onPaste={() => clipboard != null && updateDrawerMask(clipboard)}
      />
    </Card.Root>
  );
}
