import * as React from "react";
import { Box, Flex, Heading, Skeleton, Text } from "@chakra-ui/react";

export type SimpleStat = {
  /** Optional stable id for React key; falls back to label if missing */
  id?: string;
  /** Top-left label (e.g. "Total", "Pending") */
  label: string;
  /** Big centered number/text */
  value: string | number;
  /** Optional small text under the value */
  sub?: string;
  /** Chakra color palette name (e.g. "green", "red", "orange"). Default: "gray" */
  palette?: string;
};

/** Generic card that uses a chakra color palette */
function StatCardBox({
  palette = "gray",
  children,
}: {
  palette?: string;
  children: React.ReactNode;
}) {
  const base = palette;

  return (
    <Box
      borderWidth="1px"
      borderColor={`${base}.300`}
      rounded="lg"
      p="3"
      bg={`${base}.50`}
      color={`${base}.900`}
      _dark={{
        borderColor: `${base}.600`,
        bg: `${base}.900`,
        color: `${base}.50`,
      }}
      h="full"
    >
      {children}
    </Box>
  );
}

export function StatCardsRow({
  label,
  value,
  sub,
  palette = "gray",
  loading,
  cardW = "170px",
  cardH = "70px",
}: {
  label: string;
  value: string | number;
  sub?: string;
  palette?: string;
  loading?: boolean;
  cardW?: string | number;
  cardH?: string | number;
}) {
  const basis = typeof cardW === "number" ? `${cardW}px` : cardW;

  if (loading) {
    return (
      <Flex wrap="wrap" gap="3" align="stretch">
        {Array.from({ length: 4 }).map((_, i) => (
          <Box key={i} flex={`0 0 ${basis}`} maxW={basis}>
            <Box borderWidth="1px" rounded="lg" p="3" h={cardH}>
              <Skeleton h="full" />
            </Box>
          </Box>
        ))}
      </Flex>
    );
  }

  return (
    <Flex wrap="wrap" gap="3" w={basis} align="stretch">
      <Box flex={`0 0 ${basis}`} maxW={basis}>
        <StatCardBox palette={palette}>
          <Flex
            direction="column"
            justify="center"
            align="center"
            h={cardH}
            position="relative"
          >
            {/* top-left label */}
            <Heading
              size="xs"
              position="absolute"
              top="2"
              left="3"
              fontWeight="semibold"
              fontSize="sm"
            >
              {label}
            </Heading>

            {/* centered value */}
            <Text
              fontSize="xl"
              fontWeight="bold"
              lineHeight="shorter"
              textAlign="center"
            >
              {value}
            </Text>

            {/* optional subtext under the number */}
            {sub ? (
              <Text
                color="fg.muted"
                fontSize="xs"
                mt="1"
                textAlign="center"
                lineHeight="none"
              >
                {sub}
              </Text>
            ) : null}
          </Flex>
        </StatCardBox>
      </Box>
    </Flex>
  );
}
