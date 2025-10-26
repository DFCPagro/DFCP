// src/components/PackOrderSection.tsx
import { useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Button,
  HStack,
  Separator,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { packOrder, type PackOrderResponse } from "@/api/packing";

export default function PackOrderSection({
  orderId,
  onClose,
  onSuccess,
}: {
  orderId: string;
  onClose?: () => void;
  onSuccess?: (resp: PackOrderResponse) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<PackOrderResponse | null>(null);

  async function handlePack() {
    try {
      setLoading(true);
      setErr(null);
      setResult(null);

      const resp = await packOrder(orderId);
      setResult(resp);
      onSuccess?.(resp);
    } catch (e: any) {
      setErr(e?.message || "Failed to start packing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack gap="4" borderWidth="1px" borderRadius="md" p="4" bg="bg.subtle">
      <Text fontWeight="semibold">Start packing for this order</Text>
      <Text color="fg.muted" fontSize="sm">
        This will create a packing session (and/or container/package records) for order{" "}
        <Text as="span" fontWeight="medium">
          {orderId.slice(-6)}
        </Text>
        .
      </Text>

      {error ? (
        <Alert.Root status="error" colorPalette="red">
          <Alert.Indicator />
          <AlertTitle>Couldn’t start packing</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert.Root>
      ) : null}

      {result ? (
        <Alert.Root status="success" colorPalette="green">
          <Alert.Indicator />
          <Stack gap="1">
            <AlertTitle>Packing started</AlertTitle>
            <AlertDescription>
              {result.message || "The packing session was created successfully."}
            </AlertDescription>
            <Box fontSize="sm" color="fg.muted">
              {result.packageId ? (
                <Text>Package Id: <Text as="span" fontWeight="medium">{result.packageId}</Text></Text>
              ) : null}
              {result.packingSessionId ? (
                <Text>Session Id: <Text as="span" fontWeight="medium">{result.packingSessionId}</Text></Text>
              ) : null}
            </Box>
          </Stack>
        </Alert.Root>
      ) : null}

      <HStack>
        <Button
          variant="solid"
          colorPalette="green"
          onClick={handlePack}
          disabled={loading}
        >
          {loading ? (
            <HStack>
              <Spinner size="sm" />
              <Text>Starting…</Text>
            </HStack>
          ) : (
            "Start Packing"
          )}
        </Button>

        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </HStack>

      <Separator />

      <Text fontSize="xs" color="fg.muted">
        Tip: after success, navigate to your “Packing” page to continue scanning/assigning items.
      </Text>
    </Stack>
  );
}
