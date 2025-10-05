// pages/orders/components/Section.tsx
import { Box, Button, HStack, Heading, Text, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";

type Props<T> = {
  title: ReactNode;
  items: T[];
  renderItem: (item: T) => ReactNode;
  emptyText?: string;
  showAll?: boolean;
  onToggle?: () => void;
  previewCount?: number;
};

export default function Section<T>({
  title,
  items,
  renderItem,
  emptyText = "No items.",
  showAll = false,
  onToggle,
  previewCount = 2,
}: Props<T>) {
  const list = (Array.isArray(items) ? items : []).filter(Boolean) as T[]; // ← filter out undefined/null
  const hasMore = list.length > previewCount;
  const visible = showAll ? list : list.slice(0, previewCount);

  return (
    <Box>
      {typeof title === "string" ? (
        <HStack justify="space-between" align="center" mb={3}>
          <Heading size="lg">{title}</Heading>
          {hasMore && onToggle && (
            <Button size="sm" variant="outline" onClick={onToggle}>
              {showAll ? "Show less" : "More"}
            </Button>
          )}
        </HStack>
      ) : (
        <Box mb={3}>{title}</Box>
      )}

      {list.length === 0 ? (
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
