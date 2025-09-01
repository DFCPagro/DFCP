import { useParams, Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAggregationByToken } from '@/api/aggregations';
import {
  Box,
  Heading,
  Spinner,
  Text,
  VStack,
  HStack,
  Badge,
  Table,
  Link as CLink,
} from '@chakra-ui/react';

/**
 * AggregationView page: public display of an aggregation (batch) via its
 * QR token.  Shows the list of line items and any linked containers.
 */
export default function AggregationViewPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['aggregation', token],
    queryFn: () => getAggregationByToken(token || ''),
    enabled: !!token,
  });
  return (
    <Box p={4}>
      <Heading size="lg" mb={4}>
        Aggregation Details
      </Heading>
      {isLoading && <Spinner />}
      {isError && <Text color="red.400">{(error as any)?.message || 'Failed to load aggregation'}</Text>}
      {!isLoading && data && (
        <Box borderWidth="1px" borderRadius="lg" p={4}>
          <Text fontWeight="bold">Aggregation ID: {data.id}</Text>
          {data.expiresAt && (
            <Text fontSize="sm">Expires: {new Date(data.expiresAt).toLocaleString()}</Text>
          )}
          <VStack align="stretch" mt={3} gap={4}>
            <Box>
              <Heading size="sm" mb={2}>Items</Heading>
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Produce</Table.ColumnHeader>
                    <Table.ColumnHeader>Quantity</Table.ColumnHeader>
                    <Table.ColumnHeader>Unit</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {data.items.map((it: any, idx: number) => (
                    <Table.Row key={idx}>
                      <Table.Cell>{it.produceType}</Table.Cell>
                      <Table.Cell>{it.quantity}</Table.Cell>
                      <Table.Cell>{it.unit ?? '-'}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
            {data.containers && data.containers.length > 0 && (
              <Box>
                <Heading size="sm" mb={2}>Containers</Heading>
                <HStack gap={2} wrap="wrap">
                  {data.containers.map((cid: string) => (
                    <CLink asChild>
                      <RouterLink to={`/c/${cid}`}><Badge>{cid}</Badge></RouterLink>
                    </CLink>
                  ))}
                </HStack>
              </Box>
            )}
          </VStack>
        </Box>
      )}
    </Box>
  );
}