import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { confirmArrival } from '@/api/shipments';
import { Box, Heading, Text, Button, Spinner } from '@chakra-ui/react';
import { toaster } from '@/components/ui/toaster';

/**
 * ArrivalConfirm page: confirm shipment arrival at the logistics centre using
 * the arrival QR code token.  Once confirmed, the token becomes invalid.
 */
export default function ArrivalConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const [confirmed, setConfirmed] = useState(false);

  const confirmMut = useMutation({
    mutationFn: () => confirmArrival(token || ''),
    onSuccess: (data) => {
      setConfirmed(true);
      toaster.create({ title: 'Shipment arrival confirmed', type: 'success' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err.message || 'Failed to confirm arrival';
      toaster.create({ title: msg, type: 'error' });
    },
  });

  if (!token) {
    return (
      <Box p={4}>
        <Text>Invalid token</Text>
      </Box>
    );
  }
  return (
    <Box p={4} textAlign="center">
      <Heading size="lg" mb={4}>
        Arrival Confirmation
      </Heading>
      {confirmed ? (
        <Text color="green.600">Shipment arrival has been confirmed.</Text>
      ) : (
        <>
          <Text mb={4}>Click the button below to confirm arrival.</Text>
          <Button
            colorScheme="blue"
            onClick={() => confirmMut.mutate()}
            isLoading={confirmMut.isPending}
            disabled={confirmMut.isSuccess}
          >
            Confirm Arrival
          </Button>
        </>
      )}
      {confirmMut.isSuccess && confirmMut.data && (
        <Text mt={3} fontSize="sm">
          Arrival time: {new Date((confirmMut.data as any).arrivalTime).toLocaleString()}
        </Text>
      )}
    </Box>
  );
}