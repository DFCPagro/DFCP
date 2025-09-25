import {
  Box,
  Button,
  Separator,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react"
import { useMemo, useState } from "react"
import type { FarmerOrderDTO } from "@/types/farmerOrders"
import { formatDMY } from "@/utils/date"
import RejectNoteDialog from "./RejectNoteDialog"

export type IncomingOrderCardProps = {
  order: FarmerOrderDTO

  /** Triggers accept on this order id */
  onAccept: (orderId: string) => void

  /** Triggers reject with a required note */
  onReject: (orderId: string, note: string) => void

  /** Button-level pending states for THIS card */
  accepting?: boolean
  rejecting?: boolean

  /** Optional: show a compact style */
  compact?: boolean
}

function labelShift(shift: FarmerOrderDTO["shift"]) {
  // morning -> Morning
  return shift.charAt(0).toUpperCase() + shift.slice(1)
}

export default function IncomingOrderCard({
  order,
  onAccept,
  onReject,
  accepting = false,
  rejecting = false,
  compact = false,
}: IncomingOrderCardProps) {
  const [noteOpen, setNoteOpen] = useState(false)

  const isBusy = accepting || rejecting

  const itemLine = useMemo(
    () => `${order.type}, ${order.variety}`,
    [order.type, order.variety],
  )

  const dateLabel = useMemo(
    () => `${formatDMY(order.pickUpDate)}  ${labelShift(order.shift)}`,
    [order.pickUpDate, order.shift],
  )

  return (
    <>
      <Box
        borderWidth="1px"
        borderColor="border"
        rounded="xl"
        p={compact ? 3 : 4}
        minW="280px"
        maxW="320px"
        bg="bg"
        _hover={{ shadow: "md" }}
        transition="box-shadow 0.15s ease"
      >
        <Stack gap={compact ? 2 : 3}>
          <Stack gap="1">
            <HStack justifyContent="space-between" alignItems="baseline">
              <Text fontSize="sm" color="fg.muted">
                item
              </Text>
              {/* reserved space for future thumbnail/badge if needed */}
            </HStack>
            <Text fontWeight="semibold">{itemLine}</Text>
          </Stack>

          <Stack gap="1">
            <Text fontSize="sm" color="fg.muted">
              forcastedKG
            </Text>
            <Text>{order.forcastedQuantityKg}</Text>
          </Stack>

          <Separator />

          <HStack justifyContent="space-between" alignItems="center">
            <Text color="fg.muted">{dateLabel}</Text>
          </HStack>

          <HStack justifyContent="space-between" mt={1}>
            <Button
              size={compact ? "sm" : "md"}
              colorPalette="green"
              onClick={() => onAccept(order.id)}
              disabled={isBusy}
              loading={accepting}
            >
              Accept
            </Button>

            <Button
              size={compact ? "sm" : "md"}
              variant="outline"
              colorPalette="red"
              onClick={() => setNoteOpen(true)}
              disabled={isBusy}
              loading={rejecting}
            >
              Reject
            </Button>
          </HStack>
        </Stack>
      </Box>

      <RejectNoteDialog
        isOpen={noteOpen}
        onClose={() => setNoteOpen(false)}
        onSubmit={async (note) => {
          await onReject(order.id, note)
        }}
        orderLabel={itemLine}
        loading={rejecting}
      />
    </>
  )
}
