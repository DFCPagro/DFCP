import {
  Box,
  Button,
  HStack,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react"
import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import type { AcceptedGroup } from "../../FarmerDashboard/hooks/useAcceptedFarmerOrders"
import { formatDMY } from "@/utils/date"

export type AcceptedGroupCardProps = {
  group: AcceptedGroup
  onView?: (group: AcceptedGroup) => void
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
  const navigate = useNavigate()

  const dateLabel = useMemo(
    () => `${formatDMY(group.pickUpDate)}  ${labelShift(group.shift)}`,
    [group.pickUpDate, group.shift],
  )

  // shows "14:00–16:00", or "14:30", or "Pickup time • TBD"
  const pickupTimeLabel = useMemo(() => {
    const anyGroup = group as any
    if (anyGroup.pickUpTime) return anyGroup.pickUpTime as string
    if (anyGroup.pickUpWindow?.from && anyGroup.pickUpWindow?.to) {
      return `${anyGroup.pickUpWindow.from}–${anyGroup.pickUpWindow.to}`
    }
    if (anyGroup.pickUpSlotLabel) return anyGroup.pickUpSlotLabel as string
    return "Pickup time • TBD"
  }, [group])

  const handleView = () => {
    if (onView) return onView(group)
    const dateISO =
      typeof group.pickUpDate === "string"
        ? group.pickUpDate
        : new Date(group.pickUpDate).toISOString().slice(0, 10)

    navigate(`/farmer/farmerOrderForShift/${dateISO}/${group.shift}`, {
      state: { group },
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
          <Stack gap={0}>
            <Text fontWeight="semibold">{dateLabel}</Text>
            <Text fontSize="sm" color="fg.muted">{pickupTimeLabel}</Text>
          </Stack>
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
          {group.items.map((it, idx) => {
            const hasFinal =
              it.finalQuantityKg != null && Number.isFinite(it.finalQuantityKg as number)
            const qtyLabel = hasFinal
              ? `final: ${it.finalQuantityKg}`
              : `forcasted: ${it.forcastedQuantityKg}`
            const isEven = idx % 2 === 0
            return (
              <HStack
                key={it.id}
                justifyContent="space-between"
                alignItems="center"
                p="2"
                rounded="md"
                bg={isEven ? "green.50" : "transparent"} // light green alternating background
                _dark={{ bg: isEven ? "green.900" : "transparent" }}
              >
                <Text>
                  {it.type} {it.variety ? ` ${it.variety}` : ""}
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
