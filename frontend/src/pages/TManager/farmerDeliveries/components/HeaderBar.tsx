// src/pages/tmanager/FarmerDeliveries/components/HeaderBar.tsx

import * as React from "react"
import {
  VStack,
  HStack,
  Heading,
  Text,
  IconButton,
  Spinner,
} from "@chakra-ui/react"
import { ArrowLeft } from "lucide-react"
import {
  FarmerDeliveryStatCardsRow,
  type FarmerDeliveryStat,
} from "./FarmerDeliverystatsCardRow"

export type HeaderBarProps = {
  title: string
  subtitle: string
  stats?: FarmerDeliveryStat[]
  isLoading?: boolean
  onBack?: () => void
}

export function HeaderBar({
  title,
  subtitle,
  stats,
  isLoading,
  onBack,
}: HeaderBarProps) {
  return (
    <VStack w="full" align="stretch" gap="3">
      {/* Top row: back + title + loading */}
      <HStack justify="space-between" align="center" w="full">
        <HStack gap="2">
          {onBack && (
            <IconButton
              aria-label="Back"
              size="xs"
              variant="ghost"
              onClick={onBack}
            >
              <ArrowLeft size={16} />
            </IconButton>
          )}
          <Heading size="md">{title}</Heading>
        </HStack>

        {isLoading && (
          <HStack gap="2" fontSize="xs" color="fg.muted">
            <Spinner size="xs" />
            <Text>Loading deliveries…</Text>
          </HStack>
        )}
      </HStack>

      {/* Subtitle */}
      <Text fontSize="sm" color="fg.muted">
        {subtitle}
      </Text>

      {/* Status stat cards */}
      {stats?.length ? <FarmerDeliveryStatCardsRow stats={stats} /> : null}
    </VStack>
  )
}
