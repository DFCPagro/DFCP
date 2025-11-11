import * as React from "react";
import { Box, Flex, Heading, Skeleton, Text } from "@chakra-ui/react";
import {
  STATUS_BASE_COLOR,
  type StatusKeyPickerTask as StatusKey,
  labelOf,
} from "@/components/common/statusPalettes";

export type CSStat = {
  key: string;
  label: string;
  value: string | number;
  sub?: string;
};

/** Internal card using colorPalette tokens compatible with Chakra v3 */
function StatCardBox({
  colorKey,
  children,
}: {
  colorKey: StatusKey;
  children: React.ReactNode;
}) {
  const base = STATUS_BASE_COLOR[colorKey] ?? STATUS_BASE_COLOR.open;
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
  stats,
  loading,
  cardW = "170px",
  cardH = "70px",
}: {
  stats: CSStat[];
  loading?: boolean;
  cardW?: string | number;
  cardH?: string | number;
}) {
  const basis = typeof cardW === "number" ? `${cardW}px` : cardW;

  if (loading) {
    return (
      <Flex wrap="wrap" gap="3" w="full" align="stretch">
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
    <Flex wrap="wrap" gap="3" w="full" align="stretch">
      {stats.map((s) => {
        const k = (s.key in STATUS_BASE_COLOR ? s.key : "open") as StatusKey;
        return (
          <Box key={s.key} flex={`0 0 ${basis}`} maxW={basis}>
            <StatCardBox colorKey={k}>
              <Flex
                direction="column"
                justify="center"
                align="center"
                h={cardH}
                position="relative"
              >
                {/* top-left status label */}
                <Heading
                  size="xs"
                  position="absolute"
                  top="2"
                  left="3"
                  fontWeight="semibold"
                  fontSize="sm"
                >
                  {s.label || labelOf(s.key)}
                </Heading>

                {/* centered value */}
                <Text
                  fontSize="xl"
                  fontWeight="bold"
                  lineHeight="shorter"
                  textAlign="center"
                >
                  {s.value}
                </Text>

                {/* optional subtext under the number */}
                {s.sub ? (
                  <Text
                    color="fg.muted"
                    fontSize="xs"
                    mt="1"
                    textAlign="center"
                    lineHeight="none"
                  >
                    {s.sub}
                  </Text>
                ) : null}
              </Flex>
            </StatCardBox>
          </Box>
        );
      })}
    </Flex>
  );
}
