// pages/orders/components/Section.tsx
import { Box, Button, HStack, Heading, Text, VStack } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import type { ReactNode } from "react";

type Props<T> = {
  title: ReactNode;
  items: T[];
  renderItem: (item: T) => ReactNode;
  emptyText?: string;
  showAll?: boolean;
  onToggle?: () => void;
  previewCount?: number;
  /** Accent color token, e.g. "teal.600" */
  accent?: string;
  /** Optional explicit contrast token, e.g. "pink.500" */
  contrast?: string;
};

const shimmer = keyframes`
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
`;

function contrastOf(token: string): string {
  const base = (token || "").split(".")[0];
  switch (base) {
    case "teal":
      return "pink.500";
    case "orange":
      return "blue.600";
    case "pink":
      return "teal.600";
    case "purple":
      return "yellow.400";
    case "blue":
      return "orange.500";
    case "cyan":
      return "red.500";
    case "green":
      return "purple.600";
    case "yellow":
      return "purple.700";
    default:
      return "cyan.500";
  }
}

export default function Section<T>({
  title,
  items,
  renderItem,
  emptyText = "No items.",
  showAll = false,
  onToggle,
  previewCount = 2,
  accent = "blue.600",
  contrast,
}: Props<T>) {
  const list = (Array.isArray(items) ? items : []).filter(Boolean) as T[];
  const hasMore = list.length > previewCount;
  const visible = showAll ? list : list.slice(0, previewCount);

  const A = accent;
  // const B = contrast || contrastOf(A); // not used currently, keep for future contrast accents if needed
  void contrastOf; void contrast; // silence TS when unused

  return (
    <Box borderRadius="2xl" bg="bg.canvas" p={{ base: 3, md: 4 }} shadow="lg">
      {/* header */}
      {typeof title === "string" ? (
        <HStack justify="space-between" align="center" mb={2}>
          <HStack>
            <Heading size="lg">{title}</Heading>
            <Box
              as="span"
              px="2"
              py="0.5"
              fontSize="sm"
              borderRadius="full"
              bg={A}
              color="white"
              shadow="sm"
            >
              {list.length}
            </Box>
          </HStack>
          {hasMore && onToggle && (
            <Button size="sm" variant="solid" colorPalette="gray" onClick={onToggle}>
              {showAll ? "Show less" : "More"}
            </Button>
          )}
        </HStack>
      ) : (
        <Box mb={2}>{title}</Box>
      )}

      {/* high-contrast divider */}
      <Box
        h="4px"
        w="100%"
        borderRadius="full"
        bgGradient="linear(to-r, green.700, yellow.600, red.600)"
        bgSize="200% 100%"
        animation={`${shimmer} 2.2s linear infinite`}
        mb={{ base: 3, md: 4 }}
      />

      {/* content */}
      {list.length === 0 ? (
        <Text color="fg.muted">{emptyText}</Text>
      ) : (
        <VStack align="stretch" gap={0}>
          {visible.map((it, idx) => (
            <Box key={idx}>
              <Box
                px={{ base: 2, md: 3 }}
                py={{ base: 2, md: 3 }}
                borderRadius="lg"
                borderLeftWidth="4px"
                borderLeftColor="green.700"
                shadow="sm"
                _hover={{ bg: "bg.subtle", transform: "translateX(2px)" }}
                transition="background 0.15s ease, transform 0.15s ease"
              >
                {renderItem(it)}
              </Box>

              {idx < visible.length - 1 && (
                <Box
                  h="2px"
                  w="100%"
                  my={{ base: 2, md: 3 }}
                  bgGradient="linear(to-r, transparent, red.600, transparent)"
                  opacity={0.9}
                />
              )}
            </Box>
          ))}
        </VStack>
      )}

      {!showAll && hasMore && onToggle ? (
        <Box textAlign="center" mt={3}>
          <Button size="sm" variant="outline" onClick={onToggle}>
            Show all
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
