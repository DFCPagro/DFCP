import { memo } from "react"
import {
  Box,
  Button,
  Card,
  HStack,
  Icon,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react"
import { FiMapPin, FiRefreshCw, FiAlertCircle } from "react-icons/fi"

export type ActivationGateProps = {
  /** true while validating a persisted selection or fetching addresses/shifts */
  loading?: boolean
  /** optional error message to show a non-blocking note */
  error?: string | null
  /** open the Address/Shift Drawer (picker mode) */
  onOpenPicker: () => void
  /** optional: when you want to retry validation manually */
  onRetry?: () => void
}

/**
 * Inactive-state panel shown until the user picks a valid Address + Shift.
 * - Shows a concise explanation
 * - Primary action opens the Address/Shift drawer in "picker" mode
 * - Optional retry button if the parent wants to expose a manual revalidate
 */
function ActivationGateBase({
  loading,
  error,
  onOpenPicker,
  onRetry,
}: ActivationGateProps) {
  return (
    <Box width="full" py="8">
      <Card.Root
        variant="elevated"
        maxW="xl"
        mx="auto"
        bg="bg.muted"
        shadow="md"
        borderRadius="2xl"
      >
        <Card.Body>
          <Stack gap="4" align="center" textAlign="center">
            <Icon as={FiMapPin} boxSize="10" color="teal.500" />

            <Stack gap="1">
              <Text fontWeight="semibold" fontSize="lg">
                Choose your delivery address & shift to view the market
              </Text>
              <Text color="fg.muted">
                We’ll tailor the available stock to your location and time
                window. You can change these anytime.
              </Text>
            </Stack>

            {loading ? (
              <HStack gap="2">
                <Spinner size="sm" />
                <Text>Checking your saved selection…</Text>
              </HStack>
            ) : (
              <HStack gap="3">
                <Button colorPalette="teal" onClick={onOpenPicker}>
                  <Icon as={FiMapPin} mr="2" />
                  Pick address & shift
                </Button>
                {onRetry && (
                  <Button variant="outline" onClick={onRetry}>
                    <Icon as={FiRefreshCw} mr="2" />
                    Retry
                  </Button>
                )}
              </HStack>
            )}

            {error ? (
              <HStack gap="2" color="red.500">
                <Icon as={FiAlertCircle} />
                <Text fontSize="sm">{error}</Text>
              </HStack>
            ) : null}
          </Stack>
        </Card.Body>
      </Card.Root>
    </Box>
  )
}

export const ActivationGate = memo(ActivationGateBase)
