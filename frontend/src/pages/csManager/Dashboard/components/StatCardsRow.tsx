// src/pages/csManagerDashboard/components/StatCardsRow.tsx
import { SimpleGrid, Box, Heading, Text, Skeleton } from "@chakra-ui/react";

export type CSStat = { key: string; label: string; value: string | number; sub?: string };

const cardStyle = {
  borderWidth: "1px",
  // add color to the border (light/dark friendly)
  borderColor: { base: "blue.300", _dark: "blue.500" },
  rounded: "lg",
  p: "4",
  bg: "bg",
};

export function StatCardsRow({ stats, loading }: { stats: CSStat[]; loading?: boolean }) {
  if (loading) {
    return (
      <SimpleGrid
        // 1 per row on mobile, ALL on one row from md and up
        columns={{ base: 1, md: 4 }}
        gap="4"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Box key={i} {...cardStyle}>
            <Skeleton h="16" />
          </Box>
        ))}
      </SimpleGrid>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 4 }} gap="4">
      {stats.map((s) => (
        <Box key={s.key} {...cardStyle}>
          <Heading size="sm" mb="1">
            {s.label}
          </Heading>
          <Text fontSize="2xl" fontWeight="bold">
            {s.value}
          </Text>
          {s.sub && (
            <Text color="fg.muted" fontSize="sm">
              {s.sub}
            </Text>
          )}
        </Box>
      ))}
    </SimpleGrid>
  );
}
