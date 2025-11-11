// src/pages/opManager/picker-tasksManagement/index.tsx
import * as React from "react";
import { HStack, Heading, Spinner, Card } from "@chakra-ui/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  PickerTask,
  PickerTaskListResponse,
  ShiftName as PickerShiftName,
} from "@/api/pickerTask";
import {
  fetchPickerTasksForShift as fetchPickerTasksForShiftAPI,
  generatePickerTasks as generatePickerTasksAPI,
} from "@/api/pickerTask";
import {
  fetchCurrentShift,
  type CurrentShiftResp,
  type ShiftName as ApiShiftName,
} from "@/api/shifts";
import TaskDetailsModal from "./components/taskDetailsModal";
import PickerTasksTable from "./components/pickerTasksTable";
import HeaderBar from "./components/HeaderBar.tsx";
import { getDayOfWeek, toISODate, formatShiftLabel } from "@/utils/date";
import { StatCardsRow } from "./components/StatusStats";

/* ---------- helpers ---------- */
function isRealShiftName(s: ApiShiftName): s is PickerShiftName {
  return s !== "none";
}

/* ======================================= Page ======================================= */
export default function PickerTasksPage() {
  const qc = useQueryClient();
  const [selectedTask, setSelectedTask] = React.useState<PickerTask | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  const shiftQ = useQuery<CurrentShiftResp>({
    queryKey: ["currentShift"],
    queryFn: fetchCurrentShift,
  });

  const apiShiftName: ApiShiftName = shiftQ.data?.shift ?? "none";
  const shiftDate = toISODate(new Date());
  const enabled = isRealShiftName(apiShiftName);

  const tasksQ = useQuery<PickerTaskListResponse>({
    enabled,
    queryKey: ["pickerTasks", shiftDate, apiShiftName],
    queryFn: () =>
      fetchPickerTasksForShiftAPI({ shiftName: apiShiftName, shiftDate }),
  });

  const genAllM = useMutation({
    mutationFn: async () => {
      if (!enabled) return;
      await generatePickerTasksAPI({ shiftName: apiShiftName, shiftDate });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pickerTasks"] }),
  });

  if (shiftQ.isLoading || (!tasksQ.data && tasksQ.isLoading)) {
    return (
      <HStack p={6} gap={3}>
        <Spinner /> <Heading size="sm">Loading picker tasks…</Heading>
      </HStack>
    );
  }

  if (!enabled) return <Heading size="sm">No active shift right now.</Heading>;

  // Dot-separated subtitle: date · weekday · shift
  const subtitleLeft = `${shiftDate} · ${getDayOfWeek(shiftDate)} · ${formatShiftLabel(apiShiftName)}`;

  // Normalize stats (use API counts if present; else compute from items)
  const items = tasksQ.data?.items ?? [];
  const total = tasksQ.data?.pagination?.total ?? items.length;
  const counts =
    tasksQ.data?.countsByStatus ??
    items.reduce((acc, t) => {
      const k = (t.status || "open") as string;
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  // Build stat-cards array (order: Total, Problem, In progress, Open, Done)
  const stats = [
    { key: "total",       label: "Total",       value: total },
    { key: "problem",     label: "Problem",     value: counts.problem ?? 0 },
    { key: "in_progress", label: "In progress", value: counts.in_progress ?? 0 },
    { key: "open",        label: "Open",        value: counts.open ?? 0 },
    { key: "done",        label: "Done",        value: counts.done ?? 0 },
  ];

  return (
    <Card.Root>
      <Card.Header>
        <HeaderBar title="Picker Tasks" subtitle={subtitleLeft} stats={stats} />

      </Card.Header>

      <Card.Body>
       

        {items.length ? (
          <>
            <PickerTasksTable
              data={
                {
                  items,
                  countsByStatus: counts,
                  pagination: { total },
                } as PickerTaskListResponse
              }
              onView={(t) => {
                setSelectedTask(t);
                setModalOpen(true);
              }}
            />
            <TaskDetailsModal
              task={selectedTask}
              open={modalOpen}
              onClose={() => setModalOpen(false)}
            />
          </>
        ) : (
          <Heading size="sm" mt={4}>No tasks yet for this shift.</Heading>
        )}
      </Card.Body>
    </Card.Root>
  );
}
