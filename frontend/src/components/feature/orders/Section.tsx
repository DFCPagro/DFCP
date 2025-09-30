// src/components/orders/Section.tsx
import { Box, Button, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";

export default function Section<T>({
  title,
  items,
  renderItem,
  emptyText,
  showAll,
  onToggle,
  previewCount = 2,
}: {
  title: string;
  items: T[];
  renderItem: (item: T) => ReactNode;
  emptyText: string;
  showAll: boolean;
  onToggle: () => void;
  previewCount?: number;
}) {
  const preview = (items ?? []).slice(0, previewCount);
  const visible = showAll ? items : preview;

  return (
    <Box mb={8}>
      <HStack justify="space-between" mb={3}>
        <Heading size="md">{title}</Heading>
        {(items ?? []).length > previewCount && (
          <Button variant="outline" size="sm" onClick={onToggle}>
            {showAll ? "Show less" : "More"}
          </Button>
        )}
      </HStack>

      {!items || items.length === 0 ? (
        <Text color="gray.600">{emptyText}</Text>
      ) : (
        <VStack align="stretch" gap={3}>
          {visible.map((it, idx) => (
            <Box key={idx}>{renderItem(it)}</Box>
          ))}
        </VStack>
      )}
    </Box>
  );
}
