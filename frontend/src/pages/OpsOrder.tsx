import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getOrderByOpsToken } from '@/api/orders';
import {
  Box,
  Heading,
  Spinner,
  Text,
  Table,
  VStack,
} from '@chakra-ui/react';

/**
 * OpsOrder page: displays order details when scanning an ops token.  This
 * endpoint is public and used by warehouse/logistics staff to prepare
 * shipments.
 */
export default function OpsOrderPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['opsOrder', token],
    queryFn: () => getOrderByOpsToken(token || ''),
    enabled: !!token,
  });
  return (
    <Box p={4}>
      <Heading size="lg" mb={4}>
        Order Details
      </Heading>
      {isLoading && <Spinner />}
      {isError && <Text color="red.400">{(error as any)?.message || 'Failed to load order'}</Text>}
      {!isLoading && data && (
        <Box borderWidth="1px" borderRadius="lg" p={4}>
          <Text fontWeight="bold">Order #: {data.orderNo}</Text>
          <Text>Status: {data.status}</Text>
          {data.deliverySlot && (
            <Text>Delivery: {new Date(data.deliverySlot).toLocaleString()}</Text>
          )}
          <VStack align="stretch" mt={3}>
            <Heading size="sm">Items</Heading>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Product</Table.ColumnHeader>
                  <Table.ColumnHeader>Quantity</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="center">Source Farmer</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {data.items.map((it: any, idx: number) => (
                  <Table.Row key={idx}>
                    <Table.Cell>{it.productId}</Table.Cell>
                    <Table.Cell>{it.quantity}</Table.Cell>
                    <Table.Cell textAlign="center">{it.sourceFarmerId ?? '—'}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </VStack>
        </Box>
      )}
    </Box>
  );
}