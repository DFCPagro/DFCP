import * as React from "react";
import { Stack, HStack, Heading } from "@chakra-ui/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";

import { fetchCurrentShift } from "@/api/shifts";
import type { ShiftName as ApiShiftName } from "@/api/shifts";

import {
  
  generatePickerTasks as generatePickerTasksAPI,
  type PickerTask,
} from "@/api/pickerTask";

import { getOrdersForShift as getOrdersForShiftAPI } from "@/api/orders";
import type { CSOrdersResponse } from "@/types/cs.orders";

import HeaderActions from "./components/HeaderActions";
import ShiftStrip from "./components/ShiftStrip";
import OrdersCard, { type OrderLite } from "./components/OrdersCard";
//import TasksCard from "./components/TaskCard";

/* ===================================
 * Types and helpers
 * =================================== */
type ShiftName = Exclude<ApiShiftName, "none">;

type CurrentShiftCtx = {
  shift: { shiftName: ShiftName; shiftDate: string; tz?: string };
  pagination: { page: number; limit: number; total: number };
  countsByStatus: Record<string, number>;
  items: any[];
};

const SHIFT_SEQUENCE: ShiftName[] = ["morning", "afternoon", "evening", "night"];

function nextShift(name: ShiftName): ShiftName {
  const i = SHIFT_SEQUENCE.indexOf(name);
  return SHIFT_SEQUENCE[(i + 1) % SHIFT_SEQUENCE.length];
}

function isValidShiftName(s: ApiShiftName): s is ShiftName {
  return s !== "none";
}

function makeShiftsCurrentPlus5(params: {
  tz?: string;
  baseShiftName: ShiftName;
  baseShiftDate: string;
}): Array<{ shiftName: ShiftName; shiftDate: string; label: string }> {
  const { tz = "Asia/Jerusalem", baseShiftName, baseShiftDate } = params;
  const out: Array<{ shiftName: ShiftName; shiftDate: string; label: string }> = [];
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

/* ===================================
 * Main Page
 * =================================== */
export default function PickerTasksManagerPage() {
  const qc = useQueryClient();

  // 1️⃣ Load current shift
  const currentQ = useQuery({
    queryKey: ["pickerTasks", "currentShiftCtx"],
    queryFn: async (): Promise<CurrentShiftCtx> => {
      const cur = await fetchCurrentShift();
      if (!isValidShiftName(cur.shift)) throw new Error("No active shift right now");

      const tz = "Asia/Jerusalem";
      const shiftDate = DateTime.now().setZone(tz).toFormat("yyyy-LL-dd");
      return {
        shift: { shiftName: cur.shift, shiftDate, tz },
        pagination: { page: 1, limit: 0, total: 0 },
        countsByStatus: {},
        items: [],
      };
    },
  });

  const [selected, setSelected] = React.useState<{ shiftName: ShiftName; shiftDate: string } | null>(null);

  // 2️⃣ Compute 6 shifts (current + 5)
  const shifts = React.useMemo(() => {
    if (!currentQ.data?.shift) return [];
    const { shiftName, shiftDate, tz } = currentQ.data.shift;
    return makeShiftsCurrentPlus5({ tz, baseShiftName: shiftName, baseShiftDate: shiftDate });
  }, [currentQ.data]);

  // 3️⃣ Auto-select first shift
  React.useEffect(() => {
    if (shifts.length && !selected) setSelected({ shiftName: shifts[0].shiftName, shiftDate: shifts[0].shiftDate });
  }, [shifts, selected]);

  // 4️⃣ Orders for selected shift
  const ordersQ = useQuery({
    enabled: !!selected,
    queryKey: ["orders", "shift", selected?.shiftName, selected?.shiftDate],
    queryFn: async () => {
      const resp: CSOrdersResponse = await getOrdersForShiftAPI({
        date: selected!.shiftDate,
        shiftName: selected!.shiftName,
        page: 1,
        limit: 200,
      });
      return resp;
    },
  });

  // 5️⃣ Picker tasks for selected shift
  const tasksQ = useQuery({
    enabled: !!selected,
    queryKey: ["pickerTasks", "shift", selected?.shiftName, selected?.shiftDate]
     
  });

  // 6️⃣ Generate picker tasks
  const packMut = useMutation({
    mutationFn: () =>
      generatePickerTasksAPI({
        shiftName: selected!.shiftName,
        shiftDate: selected!.shiftDate,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pickerTasks", "shift", selected?.shiftName, selected?.shiftDate] });
      qc.invalidateQueries({ queryKey: ["pickerTasks", "currentShiftCtx"] });
    },
  });

  // 7️⃣ Derived data
  const orderItems: OrderLite[] = React.useMemo(() => (ordersQ.data as any)?.items ?? [], [ordersQ.data]);
  const orderTotal = React.useMemo(
    () => (ordersQ.data as any)?.pagination?.total ?? (ordersQ.data as any)?.items?.length ?? orderItems.length ?? 0,
    [ordersQ.data, orderItems.length]
  );

  //const taskItems: PickerTask[] = React.useMemo(() => (tasksQ.data?.items ?? []) as PickerTask[], [tasksQ.data]);
  //const taskTotal = React.useMemo(() => tasksQ.data?.pagination?.total ?? taskItems.length ?? 0, [tasksQ.data, taskItems.length]);

  /* ===================================
   * Render
   * =================================== */
  return (
    <Stack gap={6}>
      {/* Header */}
      <HStack justify="space-between">
        <Heading size="lg">Picker Tasks</Heading>
        <HeaderActions
          onRefresh={() => {
            qc.invalidateQueries({ queryKey: ["pickerTasks", "currentShiftCtx"] });
            if (selected) {
              qc.invalidateQueries({ queryKey: ["orders", "shift", selected.shiftName, selected.shiftDate] });
              qc.invalidateQueries({ queryKey: ["pickerTasks", "shift", selected.shiftName, selected.shiftDate] });
            }
          }}
        />
      </HStack>

      {/* Shift Selector */}
      <ShiftStrip
        shifts={shifts}
        selected={selected}
        onSelect={(s) => setSelected(s)}
        isLoading={currentQ.isLoading}
        errorMsg={currentQ.isError ? (currentQ.error as Error)?.message || "Failed to load current shift" : null}
      />

      {/* Orders & Pack Button */}
      <OrdersCard
        orders={orderItems}
        total={orderTotal}
        isLoading={ordersQ.isLoading}
        errorMsg={ordersQ.isError ? (ordersQ.error as Error)?.message || "Failed to load orders" : null}
        onPack={() => packMut.mutate()}
        canPack={!!selected && !ordersQ.isLoading}
        isPacking={packMut.isPending}
      />

      {/* Picker Tasks Table */}
      {/*<TasksCard
        tasks={taskItems}
        total={taskTotal}
        countsByStatus={tasksQ.data?.countsByStatus}
        isLoading={tasksQ.isLoading}
        errorMsg={tasksQ.isError ? (tasksQ.error as Error)?.message || "Failed to load tasks" : null}
      />*/}
    </Stack>
  );
}
