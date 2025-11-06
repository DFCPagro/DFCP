import * as React from "react"
import { Stack, HStack, Heading, Text, Box, SimpleGrid, Spinner, Icon } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { DateTime } from "luxon"
import { AlertTriangle } from "lucide-react"

import { fetchCurrentShift } from "@/api/shifts"
import type { ShiftName as ApiShiftName } from "@/api/shifts"

import {
  fetchPickerTasksForShift,
  fetchShiftPickerTasksSummary,
  type ShiftName,
  type PickerTask,
} from "@/api/pickerTask"

import PickerTasksTable from "./components/pickerTasksTable"
import TaskDetailsModal from "./components/taskDetailsModal"

function isValidShiftName(s: ApiShiftName): s is ShiftName {
  return s !== "none"
}

const ErrorBanner = ({ children }: { children: React.ReactNode }) => (
  <Box role="alert" borderWidth="1px" borderRadius="md" p={3} bg="red.50" borderColor="red.200">
    <HStack align="start" gap={2}>
      <Icon as={AlertTriangle} boxSize={4} color="red.500" />
      <Text>{children}</Text>
    </HStack>
  </Box>
)

export default function PickerTasksPage() {
  const [selectedTask, setSelectedTask] = React.useState<PickerTask | null>(null)
  const [open, setOpen] = React.useState(false)

  const currentQ = useQuery({
    queryKey: ["pickerTasks", "currentShiftCtx"],
    queryFn: async () => {
      const cur = await fetchCurrentShift()
      if (!isValidShiftName(cur.shift)) throw new Error("No active shift right now")
      const tz = "Asia/Jerusalem"
      const shiftDate = DateTime.now().setZone(tz).toFormat("yyyy-LL-dd")
      return { shiftName: cur.shift as ShiftName, shiftDate, tz }
    },
  })

  const tasksQ = useQuery({
    enabled: !!currentQ.data,
    queryKey: ["pickerTasks", "shift", currentQ.data?.shiftName, currentQ.data?.shiftDate],
    queryFn: async () => {
      const { shiftName, shiftDate } = currentQ.data!
      const res= await fetchPickerTasksForShift({ shiftName, shiftDate, page: 1, limit: 500 })
      console.log("picker tasks for shift", res)
      return res
    },
  })

  const summaryQ = useQuery({
    enabled: !!currentQ.data,
    queryKey: ["pickerTasks", "shiftSummary", currentQ.data?.shiftName, currentQ.data?.shiftDate],
    queryFn: async () => {
      const { shiftName, shiftDate } = currentQ.data!
      const res = await fetchShiftPickerTasksSummary({ shiftName, shiftDate })
      console.log("shift summary", res)
      return res
    },
  })

  const isLoading = currentQ.isLoading || tasksQ.isLoading || summaryQ.isLoading
  const shiftTitle = currentQ.data ? `${currentQ.data.shiftDate} • ${currentQ.data.shiftName}` : "Current Shift"

  const onView = (t: PickerTask) => {
    setSelectedTask(t)
    setOpen(true)
  }

  return (
    <Stack gap={6}>
      <HStack justifyContent="space-between">
        <Heading size="lg">Picker Tasks — {shiftTitle}</Heading>
      </HStack>

      {isLoading && (
        <HStack>
          <Spinner />
          <Text>Loading current shift…</Text>
        </HStack>
      )}

      {currentQ.isError && <ErrorBanner>{(currentQ.error as Error)?.message || "Failed to load current shift"}</ErrorBanner>}
      {!isLoading && (tasksQ.isError || summaryQ.isError) && (
        <ErrorBanner>{((tasksQ.error || summaryQ.error) as Error)?.message || "Failed to load data"}</ErrorBanner>
      )}

      {summaryQ.data && (
        <SimpleGrid columns={[1, 5]} gap={4}>
          {Object.entries({
            "Total Tasks": summaryQ.data.totalTasks ?? 0,
            Ready: summaryQ.data.counts?.ready ?? 0,
            "In Progress": summaryQ.data.counts?.in_progress ?? 0,
            Open: summaryQ.data.counts?.open ?? 0,
            Problem: summaryQ.data.counts?.problem ?? 0,
          }).map(([label, val]) => (
            <Box key={label} p={3} borderWidth="1px" borderRadius="md">
              <Text fontSize="sm" color="gray.500">{label}</Text>
              <Heading size="md">{val}</Heading>
            </Box>
          ))}
        </SimpleGrid>
      )}

      {tasksQ.data && <PickerTasksTable data={tasksQ.data} onView={onView} />}

      <TaskDetailsModal task={selectedTask} open={open} onClose={() => setOpen(false)} />
    </Stack>
  )
}
