import * as React from "react";
import { Box, Flex, Heading, Skeleton, Text } from "@chakra-ui/react";

// Generic stat item type
export type GenericStat<K extends string = string> = {
  key: K;
  label?: string;
  value: string | number;
  sub?: string;
};

// Map from key -> base Chakra color (e.g. "green", "red", "blue")
export type ColorMap<K extends string = string> = Record<K, string>;

/** Internal card using colorPalette tokens compatible with Chakra v3 */
function StatCardBox<K extends string>({
  colorKey,
  colorMap,
  defaultColorKey,
  children,
}: {
  colorKey: K;
  colorMap: ColorMap<K>;
  defaultColorKey?: K;
  children: React.ReactNode;
}) {
  const fallbackKey = defaultColorKey ?? (Object.keys(colorMap)[0] as K | undefined);
  const base =
    colorMap[colorKey] ??
    (fallbackKey ? colorMap[fallbackKey] : undefined) ??
    "gray";

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

export type StatCardsRowProps<K extends string = string> = {
  stats: GenericStat<K>[];
  loading?: boolean;
  cardW?: string | number;
  cardH?: string | number;
  colorMap: ColorMap<K>;
  defaultColorKey?: K;
  getLabel?: (key: K) => string;
};

export function StatCardsRow<K extends string = string>({
  stats,
  loading,
  cardW = "170px",
  cardH = "70px",
  colorMap,
  defaultColorKey,
  getLabel,
}: StatCardsRowProps<K>) {
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
        const label = s.label ?? (getLabel ? getLabel(s.key as K) : String(s.key));
        const k = s.key as K;

        return (
          <Box key={s.key} flex={`0 0 ${basis}`} maxW={basis}>
            <StatCardBox<K>
              colorKey={k}
              colorMap={colorMap}
              defaultColorKey={defaultColorKey}
            >
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
                  {label}
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
