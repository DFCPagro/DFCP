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

import { useAcceptedFarmerOrders } from "../hooks/useAcceptedFarmerOrders"
import AcceptedGroupCard from "./AcceptedGroupCard"

export type AcceptedOrdersStripProps = {
  /** Optional section title */
  title?: string
}

export default function AcceptedOrdersStrip({
  title = "Accepted Orders",
}: AcceptedOrdersStripProps) {
  const { groups, isLoading, isFetching, isError, error } = useAcceptedFarmerOrders()

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
          <>
            <Skeleton rounded="xl" minW="320px" height="220px" />
            <Skeleton rounded="xl" minW="320px" height="220px" />
            <Skeleton rounded="xl" minW="320px" height="220px" />
          </>
        ) : isError ? (
          <Box
            borderWidth="1px"
            rounded="lg"
            p="4"
            minW="320px"
            bg="bg"
            borderColor="red.300"
          >
            <Text color="red.500" fontSize="sm">
              {error?.message ?? "Failed to load accepted orders."}
            </Text>
          </Box>
        ) : groups.length === 0 ? (
          // Guard for dev/fake mode; real DB should rarely be empty per your note
          <Box borderWidth="1px" rounded="lg" p="4" minW="320px" bg="bg">
            <Text color="fg.muted">No accepted orders.</Text>
          </Box>
        ) : (
          groups.map((g) => <AcceptedGroupCard key={g.key} group={g} />)
        )}
      </Box>

      {isFetching && !isLoading ? (
        <Text fontSize="xs" color="fg.muted">
          Updating…
        </Text>
      ) : null}
    </Stack>
  )
}
