import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { confirmOrderByCustomerToken } from '@/api/orders';
import {
  Box,
  Heading,
  Text,
  VStack,
  RadioGroup,
  HStack,
  Textarea,
  Button,
  Spinner,
} from '@chakra-ui/react';
import { toaster } from '@/components/ui/toaster';

/**
 * CustomerConfirm page: allow consumer to confirm delivery of their order and
 * optionally leave a rating and comment for the farmer/driver.  Uses the
 * customer token to prevent replay and mark the order confirmed server-side.
 */
export default function CustomerConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const [rating, setRating] = useState<string>('5');
  const [comment, setComment] = useState('');

  const confirmMut = useMutation({
    mutationFn: () => confirmOrderByCustomerToken(token || '', { rating: Number(rating), comment }),
    onSuccess: () => {
      toaster.create({ title: 'Delivery confirmed', type: 'success' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err.message || 'Failed to confirm order';
      toaster.create({ title: msg, type: 'error' });
    },
  });

  const submit = () => {
    if (!token) return;
    confirmMut.mutate();
  };

  if (!token) {
    return (
      <Box p={4}>
        <Text>Invalid token</Text>
      </Box>
    );
  }

  return (
    <Box p={4} maxW="480px" mx="auto">
      <Heading size="lg" mb={4} textAlign="center">
        Confirm Delivery
      </Heading>
      <VStack align="stretch" gap={4}>
        <Box>
          <Text mb={1}>Rate your experience:</Text>
          <RadioGroup.Root
  value={rating}
  onValueChange={(details) => setRating(details.value)}
>
  <HStack gap={3}>
    <RadioGroup.Item value="1">
      <RadioGroup.ItemHiddenInput />
      <RadioGroup.ItemIndicator />
      <RadioGroup.ItemText>1</RadioGroup.ItemText>
    </RadioGroup.Item>
    <RadioGroup.Item value="2">
      <RadioGroup.ItemHiddenInput />
      <RadioGroup.ItemIndicator />
      <RadioGroup.ItemText>2</RadioGroup.ItemText>
    </RadioGroup.Item>
    <RadioGroup.Item value="3">
      <RadioGroup.ItemHiddenInput />
      <RadioGroup.ItemIndicator />
      <RadioGroup.ItemText>3</RadioGroup.ItemText>
    </RadioGroup.Item>
    <RadioGroup.Item value="4">
      <RadioGroup.ItemHiddenInput />
      <RadioGroup.ItemIndicator />
      <RadioGroup.ItemText>4</RadioGroup.ItemText>
    </RadioGroup.Item>
    <RadioGroup.Item value="5">
      <RadioGroup.ItemHiddenInput />
      <RadioGroup.ItemIndicator />
      <RadioGroup.ItemText>5</RadioGroup.ItemText>
    </RadioGroup.Item>
  </HStack>
</RadioGroup.Root>
        </Box>
        <Box>
          <Text mb={1}>Comments (optional):</Text>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell us more..." />
        </Box>
        <Button colorScheme="blue" onClick={submit} loading={confirmMut.isPending}>
          Confirm Delivery
        </Button>
        {confirmMut.isSuccess && (
          <Text color="green.600">Thank you! Your confirmation has been recorded.</Text>
        )}
      </VStack>
    </Box>
  );
}