import { useParams, Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getContainerByBarcode } from '@/api/containers';
import {
  Box,
  Heading,
  Spinner,
  Text,
  Badge,
  VStack,
  Link as CLink
} from '@chakra-ui/react';

/**
 * ContainerView page: public details for a scanned container via its
 * barcode.  Shows metadata and scan status.
 */
export default function ContainerViewPage() {
  const { barcode } = useParams<{ barcode: string }>();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['container', barcode],
    queryFn: () => getContainerByBarcode(barcode || ''),
    enabled: !!barcode,
  });
  return (
    <Box p={4}>
      <Heading size="lg" mb={4}>
        Container Details
      </Heading>
      {isLoading && <Spinner />}
      {isError && <Text color="red.400">{(error as any)?.message || 'Failed to load container'}</Text>}
      {!isLoading && data && (
        <Box borderWidth="1px" borderRadius="lg" p={4}>
          <Text fontWeight="bold">Barcode: {data.barcode}</Text>
          <Text>Produce: {data.produceType}</Text>
          <Text>Quantity: {data.quantity}</Text>
          {data.weight !== undefined && <Text>Weight: {data.weight}</Text>}
          {data.qualityGrade && <Text>Grade: {data.qualityGrade}</Text>}
          {data.aggregationId && (
             <CLink as={Badge} asChild>
                <RouterLink to={`/ag/${data.aggregationId}`}>{data.aggregationId}</RouterLink>
              </CLink>
              
            )}
            {/* <Text>
              Aggregation: <Badge as={RouterLink} to={`/ag/${data.aggregationId}`}>{data.aggregationId}</Badge>
            </Text> */}
          {data.scannedAt && (
            <VStack align="start" mt={2}>
              <Badge colorScheme="green">Scanned</Badge>
              <Text fontSize="sm">By driver: {data.scannedBy}</Text>
              <Text fontSize="sm">
                At: {new Date(data.scannedAt).toLocaleString()}
              </Text>
            </VStack>
          )}
        </Box>
      )}
    </Box>
  );
}