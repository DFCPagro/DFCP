import {
  Box,
  Button,
  HStack,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react"
import { useMemo } from "react"
import type { AcceptedGroup } from "../hooks/useAcceptedFarmerOrders"
import { formatDMY } from "@/utils/date"
import { toaster } from "@/components/ui/toaster"

export type AcceptedGroupCardProps = {
  group: AcceptedGroup
  /** Optional override for the View action; default shows a WIP toast */
  onView?: (group: AcceptedGroup) => void
  /** Optional compact spacing */
  compact?: boolean
}

function labelShift(shift: AcceptedGroup["shift"]) {
  return shift.charAt(0).toUpperCase() + shift.slice(1)
}

export default function AcceptedGroupCard({
  group,
  onView,
  compact = false,
}: AcceptedGroupCardProps) {
  const dateLabel = useMemo(
    () => `${formatDMY(group.pickUpDate)}  ${labelShift(group.shift)}`,
    [group.pickUpDate, group.shift],
  )

  const handleView = () => {
    if (onView) return onView(group)
    toaster.create({
      type: "info",
      title: "WIP",
      description: "This view will open a detailed page later.",
      duration: 2500,
    })
  }

  return (
    <Box
      borderWidth="1px"
      borderColor="border"
      rounded="xl"
      p={compact ? 3 : 4}
      minW="320px"
      maxW="400px"
      bg="bg"
      _hover={{ shadow: "md" }}
      transition="box-shadow 0.15s ease"
    >
      <Stack gap={compact ? 2 : 3}>
        {/* Header */}
        <HStack justifyContent="space-between" alignItems="center">
          <Text fontWeight="semibold">{dateLabel}</Text>
          <Button size={compact ? "sm" : "xs"} variant="outline" onClick={handleView}>
            View
          </Button>
        </HStack>

        <Separator />

        {/* Column headers */}
        <HStack justifyContent="space-between" color="fg.muted" fontSize="sm">
          <Text>Item</Text>
          <Text>Quantity (KG)</Text>
        </HStack>

        {/* Items */}
        <Stack gap="2" maxHeight="260px" overflowY="auto" pr="1">
          {group.items.map((it) => {
            const hasFinal =
              it.finalQuantityKg != null && Number.isFinite(it.finalQuantityKg as number)
            const qtyLabel = hasFinal
              ? `final: ${it.finalQuantityKg}`
              : `forcasted: ${it.forcastedQuantityKg}`
            return (
              <HStack key={it.id} justifyContent="space-between" alignItems="center">
                <Text>
                  {it.type} {it.variety ? `, ${it.variety}` : ""}
                </Text>
                <Text>{qtyLabel}</Text>
              </HStack>
            )
          })}
        </Stack>
      </Stack>
    </Box>
  )
}
