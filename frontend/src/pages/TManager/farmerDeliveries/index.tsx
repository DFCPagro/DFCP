// src/pages/tmanager/FarmerDeliveriesDashboard/ShiftDetailsPage.tsx

import * as React from "react"
import {
  Box,
  Card,
  HStack,
  Heading,
  IconButton,
  Skeleton,
  Spinner,
  Stack,
  Text,
  Badge,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

import { getDayOfWeek } from "@/utils/date"
import { HeaderBar } from "./components/HeaderBar"
import {
  getFarmerDeliveriesByShift,
  type FarmerDeliveryDTO,
  type ShiftName,
} from "@/api/farmerDelivery"

import type { StatusKeyFarmerDelivery } from "@/components/common/statusPalettes"
import type { FarmerDeliveryStat } from "./components/FarmerDeliverystatsCardRow"

// small helper (dup from index.tsx to avoid circular deps)
function formatShiftLabel(shift: ShiftName) {
  switch (shift) {
    case "morning":
      return "Morning"
    case "afternoon":
      return "Afternoon"
    case "evening":
      return "Evening"
    case "night":
      return "Night"
    default:
      return shift
  }
}

function useFarmerDeliveriesDetails(params: {
  pickUpDate?: string
  shift?: ShiftName
}) {
  const { pickUpDate, shift } = params
  const enabled = Boolean(pickUpDate && shift)

  return useQuery({
    queryKey: ["farmerDeliveriesByShift", { pickUpDate, shift }],
    queryFn: () =>
      getFarmerDeliveriesByShift({
        pickUpDate: pickUpDate!,
        shift: shift!,
      }),
    enabled,
  })
}

type RouteParams = {
  date?: string
  shift?: string
}

export default function FarmerDeliveryShiftDetailsPage() {
  const nav = useNavigate()
  const { date, shift } = useParams<RouteParams>()

  const normalizedShift = (shift ?? "") as ShiftName | ""

  const detailsQuery = useFarmerDeliveriesDetails({
    pickUpDate: date,
    shift: normalizedShift || undefined,
  })

  const deliveries: FarmerDeliveryDTO[] = detailsQuery.data ?? []
  const isLoading = detailsQuery.isLoading

  if (!date || !normalizedShift) {
    return (
      <Box w="full">
        <Stack gap="4">
          <HStack>
            <IconButton
              aria-label="Back"
              size="xs"
              variant="ghost"
              onClick={() => nav(-1)}
            >
              <ArrowLeft size={16} />
            </IconButton>
            <Heading size="md">Farmer deliveries</Heading>
          </HStack>
          <Text fontSize="sm" color="fg.muted">
            Invalid shift URL. Please return to the overview and try again.
          </Text>
        </Stack>
      </Box>
    )
  }

  // ---------------------------------------------------------------------------
  // Build stats based on farmer-delivery statuses
  // planned | in_progress | completed | canceled | problem
  // ---------------------------------------------------------------------------
  const counts = deliveries.reduce(
    (acc, d) => {
      const key = (d.stageKey ?? "planned") as StatusKeyFarmerDelivery
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    },
    {} as Partial<Record<StatusKeyFarmerDelivery, number>>,
  )

  const stats: FarmerDeliveryStat[] = [
    { key: "planned", value: counts.planned ?? 0 },
    { key: "in_progress", value: counts.in_progress ?? 0 },
    { key: "completed", value: counts.completed ?? 0 },
    { key: "canceled", value: counts.canceled ?? 0 },
    { key: "problem", value: counts.problem ?? 0 },
  ]

  const subtitle = `${date} · ${getDayOfWeek(date)} · ${formatShiftLabel(
    normalizedShift,
  )}`

  return (
    <Box w="full">
      <Stack gap="4">
        {/* New header with back button + stats row */}
        <HeaderBar
          title="Farmer deliveries"
          subtitle={subtitle}
          isLoading={isLoading}
          onBack={() => nav(-1)}
          stats={stats}
        />

        {/* Details card */}
        <Card.Root variant="subtle">
          <Card.Body px="4" py="3">
            {isLoading ? (
              <Stack gap="2">
                <Skeleton height="18" />
                <Skeleton height="18" />
              </Stack>
            ) : !deliveries.length ? (
              <Text fontSize="sm" color="fg.muted">
                No planned deliveries for this shift yet.
              </Text>
            ) : (
              <Stack gap="4">
                {deliveries.map((d) => (
                  <Box
                    key={d._id}
                    borderWidth="1px"
                    borderRadius="lg"
                    p="3"
                    bg="bg.subtle"
                  >
                    <HStack justify="space-between" mb="2">
                      <HStack gap="2">
                        <Text fontSize="sm" fontWeight="semibold">
                          {d.stops.length} stops ·{" "}
                          {d.totalExpectedContainers ?? 0} containers
                        </Text>
                      </HStack>
                      {/* You can later map d.stageKey to your palette if you want the badge to match */}
                      <Badge variant="subtle" colorPalette="blue">
                        {d.stageKey ?? "planned"}
                      </Badge>
                    </HStack>

                    <Stack gap="1">
                      {d.stops.map((s) => (
                        <HStack key={`${d._id}_${s.sequence}`} gap="3">
                          <Badge
                            size="xs"
                            variant="subtle"
                            colorPalette={
                              s.type === "pickup" ? "green" : "orange"
                            }
                          >
                            {s.type === "pickup" ? "Pickup" : "Dropoff"} #
                            {s.sequence + 1}
                          </Badge>
                          <Box flex="1">
                            <Text fontSize="sm" fontWeight="medium">
                              {s.label || s.farmName}
                            </Text>
                            <Text fontSize="xs" color="fg.muted">
                              {s.farmerName} · {s.expectedContainers} containers ·{" "}
                              {Math.round(Number(s.expectedWeightKg || 0))} kg
                            </Text>
                          </Box>
                          <Text fontSize="xs" color="fg.muted">
                            {typeof s.plannedAt === "string"
                              ? s.plannedAt.slice(11, 16)
                              : new Date(s.plannedAt)
                                  .toISOString()
                                  .slice(11, 16)}
                          </Text>
                        </HStack>
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Card.Body>
        </Card.Root>
      </Stack>
    </Box>
  )
}
