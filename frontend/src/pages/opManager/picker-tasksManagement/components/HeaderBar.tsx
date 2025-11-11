import * as React from "react"
import { VStack, HStack, Heading, Text } from "@chakra-ui/react"
import { StatCardsRow } from "./StatusStats"

/**
 * HeaderBar for picker-task pages.
 * - Displays title, subtitle, and optional stats.
 * - Updated for Chakra UI v3 (uses `gap` instead of `spacing`).
 */
export default function HeaderBar({
  title,
  subtitle,
  stats,
}: {
  title: string
  subtitle?: string
  stats?: Array<{ key: string; label: string; value: string | number }>
}) {
  return (
    <VStack w="full" align="stretch" gap="3">
      {/* Title Row */}
      <HStack justify="space-between" align="center" w="full">
        <Heading size="md">{title}</Heading>
      </HStack>

      {/* Optional subtitle */}
      {subtitle && (
        <Text fontSize="sm" color="fg.muted">
          {subtitle}
        </Text>
      )}

      {/* Optional stat cards */}
      {stats?.length ? <StatCardsRow stats={stats} /> : null}
    </VStack>
  )
}
