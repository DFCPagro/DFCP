import {
  Dialog,
  Portal,
  Card,
  Text,
  Table,
  Progress,
  HStack,
  Badge,
  Separator,
  Tabs,
  Grid as CGrid,
} from "@chakra-ui/react"
  // NOTE: Chakra v3 tabs API used above
import type { ShelfDTO } from "@/types/logisticCenter"
import { useUIStore } from "@/store/useUIStore"

export default function ShelfDetailDialog({ shelf }: { shelf: ShelfDTO | null }) {
  const detailOpen = useUIStore((s) => s.detailOpen)
  const closeDetail = useUIStore((s) => s.closeDetail)
  if (!shelf) return null

  const capacityPct = Math.min(100, Math.round((shelf.currentWeightKg / Math.max(1, shelf.maxWeightKg)) * 100))

  return (
    <Dialog.Root open={detailOpen} onOpenChange={(d) => !d.open && closeDetail()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="xl" borderRadius="2xl">
            <Dialog.Header>
              <Dialog.Title>{shelf.shelfId}</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <CGrid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
                <Card.Root>
                  <Card.Body gap="3">
                    <HStack gap="2" wrap="wrap">
                      <Badge variant="subtle" colorPalette="lime">
                        Type: {shelf.type}
                      </Badge>
                      <Badge variant="subtle" colorPalette={shelf.isTemporarilyAvoid ? "yellow" : "blue"}>
                        {shelf.isTemporarilyAvoid ? "Avoid" : "Open"}
                      </Badge>
                      <Badge variant="subtle" colorPalette={shelf.busyScore >= 80 ? "red" : shelf.busyScore >= 50 ? "lime" : "green"}>
                        Busy: {shelf.busyScore}
                      </Badge>
                      <Badge variant="subtle" colorPalette="purple">
                        Tasks: {shelf.liveActiveTasks}
                      </Badge>
                    </HStack>

                    <Text>Weight Load</Text>
                    <Progress.Root value={capacityPct}>
  <Progress.Track>
    <Progress.Range />
  </Progress.Track>
  <Progress.Label />
  <Progress.ValueText />
</Progress.Root>
                    <Text fontSize="sm" color="muted">
                      {shelf.currentWeightKg} / {shelf.maxWeightKg} kg
                    </Text>
                  </Card.Body>
                </Card.Root>

                <Card.Root>
                  <Card.Body gap="2">
                    <Text fontWeight="semibold">Quick facts</Text>
                    <Text color="muted" fontSize="sm">
                      Zone: {shelf.zone ?? "-"} • Aisle: {shelf.aisle ?? "-"}
                    </Text>
                    <Text color="muted" fontSize="sm">
                      Slots: {shelf.occupiedSlots}/{shelf.maxSlots}
                    </Text>
                    <Text color="muted" fontSize="sm">
                      Last activity: {shelf.lastTaskPingAt ? new Date(shelf.lastTaskPingAt).toLocaleString() : "-"}
                    </Text>
                  </Card.Body>
                </Card.Root>
              </CGrid>

              <Separator my="4" />

              <Tabs.Root defaultValue="slots">
                <Tabs.List>
                  <Tabs.Trigger value="slots">Slots</Tabs.Trigger>
                  <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="slots">
                  <Table.Root size="sm">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Slot</Table.ColumnHeader>
                        <Table.ColumnHeader>Container</Table.ColumnHeader>
                        <Table.ColumnHeader>Weight</Table.ColumnHeader>
                        <Table.ColumnHeader>Tasks</Table.ColumnHeader>
                        <Table.ColumnHeader>Last Ping</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {shelf.slots.map((s) => (
                        <Table.Row key={s.slotId}>
                          <Table.Cell>#{s.slotId}</Table.Cell>
                          <Table.Cell>{s.containerOpsId ?? "-"}</Table.Cell>
                          <Table.Cell>
                            {s.currentWeightKg} / {s.capacityKg} kg
                          </Table.Cell>
                          <Table.Cell>{s.liveActiveTasks}</Table.Cell>
                          <Table.Cell>{s.lastTaskPingAt ? new Date(s.lastTaskPingAt).toLocaleTimeString() : "-"}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Tabs.Content>

                <Tabs.Content value="activity">
                  <Card.Root>
                    <Card.Body gap="2">
                      <Text fontSize="sm" color="muted">
                        Busy score is a rolling 0–100 crowding indicator. Live tasks shows current workers interacting with the shelf/slots.
                      </Text>
                      <HStack gap="2" wrap="wrap">
                        <Badge colorPalette={shelf.busyScore >= 80 ? "red" : "lime"}>Busy {shelf.busyScore}</Badge>
                        <Badge colorPalette="purple">Live tasks {shelf.liveActiveTasks}</Badge>
                        <Badge colorPalette="cyan">Updated {new Date(shelf.updatedAt).toLocaleTimeString()}</Badge>
                      </HStack>
                    </Card.Body>
                  </Card.Root>
                </Tabs.Content>
              </Tabs.Root>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
