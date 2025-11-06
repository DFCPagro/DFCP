import * as React from "react";
import { Stack, HStack, Heading } from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";

import { fetchCurrentShift } from "@/api/shifts";
import type { ShiftName as ApiShiftName } from "@/api/shifts";

import {
  fetchPickerTasksForShift,
  type ShiftName,
  type PickerTask,
  type PickerTaskListResponse,
} from "@/api/pickerTask";

import ShiftStrip from "./components/ShiftStrip";
import TasksCard from "./components/TaskCard";

type ShiftChip = { shiftName: ShiftName; shiftDate: string; label: string };
const SHIFT_SEQUENCE: ShiftName[] = ["morning", "afternoon", "evening", "night"];

function isValidShiftName(s: ApiShiftName): s is ShiftName {
  return s !== "none";
}
function nextShift(name: ShiftName): ShiftName {
  const i = SHIFT_SEQUENCE.indexOf(name);
  return SHIFT_SEQUENCE[(i + 1) % SHIFT_SEQUENCE.length];
}
function makeShiftsCurrentPlus5(params: {
  tz?: string;
  baseShiftName: ShiftName;
  baseShiftDate: string; // yyyy-LL-dd
}): ShiftChip[] {
  const { tz = "Asia/Jerusalem", baseShiftName, baseShiftDate } = params;
  const out: ShiftChip[] = [];
  let name = baseShiftName;
  let date = baseShiftDate;
  let dt = DateTime.fromFormat(baseShiftDate, "yyyy-LL-dd", { zone: tz });

  for (let i = 0; i < 6; i++) {
    out.push({ shiftName: name, shiftDate: date, label: `${date} • ${name}` });
    const n = nextShift(name);
    if (name === "night" && n === "morning") dt = dt.plus({ days: 1 });
    name = n;
    date = dt.toFormat("yyyy-LL-dd");
  }
  return out;
}

export default function PickerTasksManagerPage() {
  const qc = useQueryClient();

  // 1) Load current shift context
  const currentQ = useQuery({
    queryKey: ["pickerTasks", "currentShiftCtx"],
    queryFn: async () => {
      const cur = await fetchCurrentShift();
      if (!isValidShiftName(cur.shift)) throw new Error("No active shift right now");
      const tz = "Asia/Jerusalem";
      const shiftDate = DateTime.now().setZone(tz).toFormat("yyyy-LL-dd");
      return { shiftName: cur.shift as ShiftName, shiftDate, tz };
    },
  });

  // 2) Build “current + 5” list
  const shifts = React.useMemo<ShiftChip[]>(() => {
    if (!currentQ.data) return [];
    const { shiftName, shiftDate, tz } = currentQ.data;
    return makeShiftsCurrentPlus5({ tz, baseShiftName: shiftName, baseShiftDate: shiftDate });
  }, [currentQ.data]);

  // 3) Selected shift (auto-pick first)
  const [selected, setSelected] = React.useState<ShiftChip | null>(null);
  React.useEffect(() => {
    if (!selected && shifts.length) setSelected(shifts[0]);
  }, [shifts, selected]);

  // 4) Picker tasks for selected shift
  const tasksQ = useQuery({
    enabled: !!selected,
    queryKey: ["pickerTasks", "shift", selected?.shiftName, selected?.shiftDate],
    queryFn: async (): Promise<PickerTaskListResponse> => {
      // NOTE: GET endpoint ensures tasks exist for this shift automatically.
      return fetchPickerTasksForShift({
        shiftName: selected!.shiftName,
        shiftDate: selected!.shiftDate,
        // ensure?: true // default true on server; no need to pass
        page: 1,
        limit: 200,
      });
    },
  });

  // 5) Optional: prefetch the next shift to make tabbing feel instant
  React.useEffect(() => {
    if (!selected || !shifts.length) return;
    const ix = shifts.findIndex(
      (s) => s.shiftName === selected.shiftName && s.shiftDate === selected.shiftDate
    );
    const next = shifts[ix + 1];
    if (next) {
      qc.prefetchQuery({
        queryKey: ["pickerTasks", "shift", next.shiftName, next.shiftDate],
        queryFn: () =>
          fetchPickerTasksForShift({
            shiftName: next.shiftName,
            shiftDate: next.shiftDate,
            page: 1,
            limit: 200,
          }),
      });
    }
  }, [selected, shifts, qc]);

  // 6) Derived for the card
  const taskItems: PickerTask[] = tasksQ.data?.items ?? [];
  const taskTotal =
    tasksQ.data?.pagination?.total ?? tasksQ.data?.items?.length ?? taskItems.length ?? 0;

  return (
    <Stack gap={6}>
      <HStack justify="space-between">
        <Heading size="lg">Picker Tasks</Heading>
      </HStack>

      {/* Shift selector row */}
      <ShiftStrip
        shifts={shifts}
        selected={selected}
        onSelect={(s: ShiftChip) => setSelected(s)}
        isLoading={currentQ.isLoading}
        errorMsg={
          currentQ.isError ? (currentQ.error as Error)?.message || "Failed to load shift" : null
        }
      />

      {/* Tasks table for selected shift */}
      <TasksCard
        tasks={taskItems}
        total={taskTotal}
        countsByStatus={tasksQ.data?.countsByStatus}
        isLoading={tasksQ.isLoading || currentQ.isLoading || !selected}
        errorMsg={
          tasksQ.isError
            ? (tasksQ.error as Error)?.message || "Failed to load tasks"
            : null
        }
      />
    </Stack>
  );
}
