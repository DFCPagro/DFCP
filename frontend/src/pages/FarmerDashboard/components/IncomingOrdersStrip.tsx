import {
  Box,
  HStack,
  Heading,
  IconButton,
  Skeleton,
  Stack,
  Text,
} from "@chakra-ui/react"
import { useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import IncomingOrderCard from "./IncomingOrderCard"
import { useIncomingFarmerOrders } from "../hooks/useIncomingFarmerOrders"

export type IncomingOrdersStripProps = {
  /** Optional section title */
  title?: string

  /** Optionally restrict by pickup date range (YYYY-MM-DD) */
  from?: string
  to?: string

  /** Enable/disable initial fetch */
  enabled?: boolean
}

export default function IncomingOrdersStrip({
  title = "Incoming Orders",
  from,
  to,
  enabled = true,
}: IncomingOrdersStripProps) {
  const {
    orders,
    isLoading,
    isFetching,
    isError,
    error,
    accept,
    reject,
    acceptingId,
    rejectingId,
  } = useIncomingFarmerOrders({ from, to, enabled })

  const scrollerRef = useRef<HTMLDivElement>(null)
  const scrollByCards = (dir: "left" | "right") => {
    const el = scrollerRef.current
    if (!el) return
    const step = Math.round(el.clientWidth * 0.85)
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" })
  }

  return (
    <Stack gap="3" width="full">
      <HStack justifyContent="space-between" alignItems="center">
        <Heading size="md">{title}</Heading>
        <HStack gap="2">
          <IconButton
            aria-label="Scroll left"
            onClick={() => scrollByCards("left")}
            variant="ghost"
            size="sm"
          >
            <ChevronLeft />
          </IconButton>
          <IconButton
            aria-label="Scroll right"
            onClick={() => scrollByCards("right")}
            variant="ghost"
            size="sm"
          >
            <ChevronRight />
          </IconButton>
        </HStack>
      </HStack>

      <Box
        ref={scrollerRef}
        display="flex"
        gap="3"
        overflowX="auto"
        pb="1"
        css={{
          scrollSnapType: "x mandatory",
          "& > *": { scrollSnapAlign: "start" },
        }}
      >

        {isLoading ? (
          // Skeleton placeholders while initial data loads
          <>
            <Skeleton rounded="xl" minW="280px" height="160px" />
            <Skeleton rounded="xl" minW="280px" height="160px" />
            <Skeleton rounded="xl" minW="280px" height="160px" />
          </>
        ) : isError ? (
          <Box
            borderWidth="1px"
            rounded="lg"
            p="4"
            minW="280px"
            bg="bg"
            borderColor="red.300"
          >
            <Text color="red.500" fontSize="sm">
              {error?.message ?? "Failed to load incoming orders."}
            </Text>
          </Box>
        ) : orders.length === 0 ? (
          // You mentioned real DB won’t be empty, but this guards local/dev
          <Box
            borderWidth="1px"
            rounded="lg"
            p="4"
            minW="280px"
            bg="bg"
            borderColor="border"
          >
            <Text color="fg.muted">No incoming orders.</Text>
          </Box>
        ) : (
          orders.map((o) => (
            <IncomingOrderCard
              key={o.id}
              order={o}
              onAccept={accept}
              onReject={reject}
              accepting={acceptingId === o.id}
              rejecting={rejectingId === o.id}
            />
          ))
        )}
      </Box>

      {/* Subtle fetch indicator (optional) */}
      {isFetching && !isLoading ? (
        <Text fontSize="xs" color="fg.muted">
          Updating…
        </Text>
      ) : null}
    </Stack>
  )
}
