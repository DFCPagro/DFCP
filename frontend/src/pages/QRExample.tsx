// src/app/examples/QRExample.tsx (or pages/QRExample.tsx)
import React from "react";
import { Button, Box, Text, Spinner, VStack, Code, Separator } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import TokenQR from "@/components/common/TokenQR";
import { scan } from "@/api/scan";
import { type ScanResponse } from "@/types/qrToken";

const DEMO_TOKEN = "QR-b97ce09d-a4a0-45ca-93cf-5170f73d26c0";

const QRExample: React.FC = () => {
  const { data, error, isFetching, refetch, isSuccess } = useQuery<ScanResponse>({
    queryKey: ["scan", DEMO_TOKEN],
    queryFn: () => scan(DEMO_TOKEN),
    enabled: false, // manual only
    retry: 0,
  });

  return (
    <VStack align="stretch" gap={4} p={4}>
      {/* Always show a QR (input token). After scan, we can also show the server token */}
      <Box>
        <Text fontWeight="bold" mb={2}>QR (input token)</Text>
        <TokenQR token={DEMO_TOKEN} />
      </Box>

      <Separator />

      <Button
        onClick={() => refetch()}
        loading={isFetching}
        loadingText="Scanning…"
        colorScheme="blue"
        alignSelf="start"
      >
        Simulate Scan
      </Button>

      {isFetching && (
        <Box display="flex" alignItems="center" gap={2}>
          <Spinner size="sm" />
          <Text>Scanning…</Text>
        </Box>
      )}

      {error && (
        <Box p={3} borderWidth="1px" borderRadius="md" borderColor="red.300" bg="red.50">
          <Text color="red.600" fontWeight="bold" mb={1}>Scan failed</Text>
          <Code whiteSpace="pre-wrap">
            {(error as Error)?.message ?? "Unknown error"}
          </Code>
        </Box>
      )}

      {isSuccess && data && (
        <Box p={3} borderWidth="1px" borderRadius="md">
          <Text fontWeight="bold" mb={2}>Scan Result</Text>

          {/* Optionally show the QR returned by the server */}
          <Box mb={3}>
            <Text fontSize="sm" color="gray.500" mb={1}>QR (server token)</Text>
            <TokenQR token={data.data.token} />
          </Box>

          <VStack align="start" gap={1}>
            <Text><b>Scope:</b> {data.data.scope}</Text>
            <Text><b>Status:</b> {data.data.status}</Text>
            <Text><b>Subject:</b> {data.data.subjectType} • {data.data.subjectId}</Text>
            <Text><b>Scans:</b> {data.data.scansCount}</Text>
            <Text><b>Order ID:</b> {data.data.claims.orderId ?? "—"}</Text>
            <Text><b>Delivery date:</b> {data.data.claims.deliveryDate ?? "—"}</Text>
            <Text><b>Shift:</b> {data.data.claims.shift ?? "—"}</Text>
            <Text><b>Customer ID:</b> {data.data.claims.customerId ?? "—"}</Text>
          </VStack>
        </Box>
      )}
    </VStack>
  );
};

export default QRExample;
