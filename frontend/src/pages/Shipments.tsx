import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchDriverShipments,
  scanShipmentContainer,
  mintArrivalToken,
} from '@/api/shipments';
import {
  Box,
  Heading,
  Spinner,
  Text,
  VStack,
  HStack,
  Input,
  Button,
  Separator,
} from '@chakra-ui/react';
import QRCode from 'react-qr-code';
import { toaster } from '@/components/ui/toaster';

/**
 * Shipments page. Drivers can view their assigned shipments, scan container
 * barcodes to mark them loaded, and generate arrival QR codes for the
 * logistics centre to confirm delivery.
 */
export default function ShipmentsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['shipments'],
    queryFn: fetchDriverShipments,
  });

  const scanMut = useMutation({
    mutationFn: ({ shipmentId, barcode }: { shipmentId: string; barcode: string }) =>
      scanShipmentContainer(shipmentId, barcode),
    onSuccess: (_data, variables) => {
      toaster.create({ title: `Scanned ${variables.barcode}`, type: 'success' });
      qc.invalidateQueries({ queryKey: ['shipments'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err.message || 'Failed to scan container';
      toaster.create({ title: msg, type: 'error' });
    },
  });

  const arrivalMut = useMutation({
    mutationFn: ({ shipmentId, ttlDays }: { shipmentId: string; ttlDays?: number }) =>
      mintArrivalToken(shipmentId, ttlDays),
    onSuccess: (_data, variables) => {
      toaster.create({ title: 'Arrival token minted', type: 'success' });
      qc.invalidateQueries({ queryKey: ['shipments'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err.message || 'Failed to mint arrival token';
      toaster.create({ title: msg, type: 'error' });
    },
  });

  // local state for scanning input keyed by shipment id
  const [scanInputs, setScanInputs] = useState<Record<string, string>>({});

  const handleScan = (shipmentId: string) => {
    const code = scanInputs[shipmentId]?.trim();
    if (!code) return;
    scanMut.mutate({ shipmentId, barcode: code });
    setScanInputs((prev) => ({ ...prev, [shipmentId]: '' }));
  };

  return (
    <Box p={4}>
      <Heading size="lg" mb={4}>
        My Shipments
      </Heading>
      {isLoading && <Spinner />}
      {isError && <Text color="red.400">{(error as any)?.message || 'Failed to load shipments'}</Text>}
      {!isLoading && data && (
        <VStack align="stretch" gap={6}>
          {data.items.length === 0 && <Text>No shipments assigned.</Text>}
          {data.items.map((s) => {
            const total = s.containers.length;
            const scanned = s.containers.filter((c) => c.scanned).length;
            return (
              <Box key={s.id} borderWidth="1px" borderRadius="lg" p={4}>
                <Heading size="md" mb={2}>
                  Shipment #{s.id}
                </Heading>
                <Text mb={2}>Status: {s.status}</Text>
                <Text mb={2}>Progress: {scanned} / {total} containers scanned</Text>
                {/* Scan input */}
                <HStack mb={2}>
                  <Input
                    placeholder="Enter container barcode"
                    value={scanInputs[s.id] ?? ''}
                    onChange={(e) => setScanInputs((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleScan(s.id);
                    }}
                  />
                  <Button
                    onClick={() => handleScan(s.id)}
                    loading={scanMut.isPending}
                  >
                    Scan
                  </Button>
                </HStack>
                {/* Container list */}
                <VStack align="stretch" mb={3}>
                  {s.containers.map((c) => (
                    <HStack key={c.id} justify="space-between" borderWidth="1px" borderRadius="md" p={2}>
                      <Box>
                        <Text fontWeight="bold">{c.barcode}</Text>
                        <Text fontSize="sm">{c.produceType} x {c.quantity}</Text>
                      </Box>
                      <Box>{c.scanned ? '✅' : '—'}</Box>
                    </HStack>
                  ))}
                </VStack>
                <Separator my={2} />
                {/* Arrival token section */}
                {s.arrivalToken ? (
                  <Box>
                    <Text mb={1}>Arrival QR:</Text>
                    <QRCode value={`${location.origin}/a/${s.arrivalToken}`} size={96} />
                    <Text fontSize="xs" mt={1}>{`${location.origin}/a/${s.arrivalToken}`}</Text>
                    {s.arrivalExpiresAt && (
                      <Text fontSize="xs" color="gray.600">
                        Expires: {new Date(s.arrivalExpiresAt).toLocaleString()}
                      </Text>
                    )}
                    {s.arrivalUsedAt && (
                      <Text fontSize="xs" color="green.600">
                        Confirmed: {new Date(s.arrivalUsedAt).toLocaleString()}
                      </Text>
                    )}
                    {!s.arrivalUsedAt && (
                      <Button mt={2} size="sm" onClick={() => arrivalMut.mutate({ shipmentId: s.id })} loading={arrivalMut.isPending}>
                        Remint Arrival Token
                      </Button>
                    )}
                  </Box>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => arrivalMut.mutate({ shipmentId: s.id })}
                    loading={arrivalMut.isPending}
                  >
                    Mint Arrival Token
                  </Button>
                )}
              </Box>
            );
          })}
        </VStack>
      )}
    </Box>
  );
}