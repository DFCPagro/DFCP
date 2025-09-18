// src/pages/JobAppReview/components/Pagination.tsx
import { HStack, Button, Text, NativeSelect } from "@chakra-ui/react";

type Props = {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  pageSizeOptions?: number[];
};

export default function Pagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [10, 20, 50],
}: Props) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / Math.max(1, limit)));

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <HStack gap="3" justify="space-between" width="full" py="3">
      <HStack gap="2">
        <Button
          size="sm"
          variant="outline"
          disabled={prevDisabled}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={nextDisabled}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </HStack>

      <Text fontSize="sm">
        Page {page} of {totalPages}
      </Text>

      <HStack gap="2">
        <Text fontSize="sm">Rows per page</Text>
        <NativeSelect.Root size="sm" width="90px">
          <NativeSelect.Field
            value={String(limit)}
            onChange={(e) => onLimitChange(Number(e.currentTarget.value))}
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </HStack>
    </HStack>
  );
}
