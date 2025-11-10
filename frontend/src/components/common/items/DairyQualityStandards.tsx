import {
  Accordion,
  Badge,
  Box,
  Card,
  HStack,
  Input,
  Separator,
  SimpleGrid,
  Stack,
  Table,
  Tag,
  Text,
} from "@chakra-ui/react"
import { LuInfo } from "react-icons/lu"
import { Tooltip } from "@/components/ui/tooltip"

type ABC = { A?: string | null; B?: string | null; C?: string | null }

export type DairyQualityStandards = {
  /** free text */
  grade?: ABC
  /** numeric (days) */
  freshnessDays?: ABC
  /** numeric %, 0-100 */
  fatPercentage?: ABC
}

type Props = {
  value?: DairyQualityStandards | undefined
  onChange: (next: DairyQualityStandards | undefined) => void
  readOnly?: boolean
}

/** Unit chips shown to the right of inputs. */
const UNIT: Partial<Record<keyof DairyQualityStandards, string>> = {
  freshnessDays: "days",
  fatPercentage: "%",
}

/** Labels + example placeholders (without units since units are chips). */
const METRICS: Array<{
  key: keyof DairyQualityStandards
  label: string
  placeholderA?: string
  isText?: boolean
}> = [
  { key: "grade", label: "Quality grade (text)", placeholderA: "A", isText: true },
  { key: "freshnessDays", label: "Freshness (days)", placeholderA: "7+" },
  { key: "fatPercentage", label: "Fat percentage", placeholderA: "3.5–5" },
]

/**
 * Fully locked input (no focus, no typing) while keeping normal colors.
 */
function LockedInput({
  value,
  onChange,
  placeholder,
  locked,
}: {
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  locked?: boolean
}) {
  return (
    <Input
      size="sm"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={!!locked}
      readOnly={!!locked}
      _disabled={{
        opacity: 1,
        color: "fg",
        WebkitTextFillColor: "currentColor",
        bg: "transparent",
        cursor: "default",
        _placeholder: { color: "fg.muted" },
        borderColor: "border",
      }}
    />
  )
}

function UnitInput({
  value,
  onChange,
  placeholder,
  unit,
  locked,
}: {
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  unit?: string
  locked?: boolean
}) {
  return (
    <HStack gap="2" align="center">
      <LockedInput value={value} onChange={onChange} placeholder={placeholder} locked={locked} />
      {unit ? (
        <Badge variant="subtle" flexShrink={0}>
          {unit}
        </Badge>
      ) : null}
    </HStack>
  )
}

export default function DairyQualityStandardsSection({
  value,
  onChange,
  readOnly,
}: Props) {
  const setCell = (metricKey: keyof DairyQualityStandards, grade: keyof ABC, v: string) => {
    if (readOnly) return
    const next: DairyQualityStandards = { ...(value ?? {}) }
    const row: ABC = { ...(next[metricKey] ?? {}) }
    row[grade] = v || undefined
    if (!row.A) {
      delete (next as any)[metricKey]
    } else {
      ;(next as any)[metricKey] = row
    }
    onChange(Object.keys(next).length ? next : undefined)
  }

  return (
    <Accordion.Root defaultValue={["dqs"]} multiple>
      <Accordion.Item value="dqs">
        <Card.Root variant="outline" border={"none"} overflow="hidden">
          <Card.Body p="0">
            {/* Header */}
            <Box px="4" py="3" bgGradient="to-r" gradientFrom="bg" gradientTo="bg.subtle">
              <HStack justifyContent="space-between" wrap="wrap" gap="3">
                <Accordion.ItemTrigger asChild>
                  <Tag.Root
                    as="button"
                    variant="surface"
                    size="lg"
                    borderRadius="full"
                    px="4"
                    py="2"
                    cursor="pointer"
                    _hover={{ shadow: "sm" }}
                  >
                    <Tag.Label>Dairy Quality Standards — Grade A</Tag.Label>
                    <Accordion.ItemIndicator />
                  </Tag.Root>
                </Accordion.ItemTrigger>

                <HStack gap="2" wrap="wrap">
                  <Tooltip content="Guidelines for dairy products such as milk, cheese, and yogurt.">
                    <HStack gap="1">
                      <LuInfo />
                      <Text fontSize="sm" color="fg.muted">
                        Info
                      </Text>
                    </HStack>
                  </Tooltip>
                </HStack>
              </HStack>
            </Box>

            <Accordion.ItemContent>
              <Accordion.ItemBody>
                <Stack gap="5" px="4" py="4">
                  <Separator />

                  {/* Card grid on mobile, rich table on desktop */}
                  <SimpleGrid columns={{ base: 1, md: 1 }} gap="4">
                    {/* Desktop table */}
                    <Box display={{ base: "none", md: "block" }} overflowX="auto">
                      <Table.Root size="sm" variant="outline" minW="600px">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeader w="40%">Metric</Table.ColumnHeader>
                            <Table.ColumnHeader w="60%">
                              <HStack gap="2">
                                <Badge colorPalette="green" variant="solid">
                                  A
                                </Badge>
                                <Text fontWeight="medium">Best</Text>
                              </HStack>
                            </Table.ColumnHeader>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {METRICS.map(({ key, label, placeholderA, isText }) => {
                            const row = (value as any)?.[key] as ABC | undefined
                            const unit = isText ? undefined : UNIT[key]
                            const zebra = (idxFromKey(key) % 2) === 0
                            return (
                              <Table.Row key={String(key)} bg={zebra ? "bg" : "bg.subtle"}>
                                <Table.Cell>
                                  <HStack gap="2">
                                    <Box
                                      w="6px"
                                      h="18px"
                                      bg={isText ? "purple.5" : "blue.5"}
                                      borderRadius="full"
                                    />
                                    <Text fontWeight="medium">{label}</Text>
                                  </HStack>
                                </Table.Cell>
                                <Table.Cell>
                                  <UnitInput
                                    value={row?.A ?? ""}
                                    onChange={(v) => setCell(key, "A", v)}
                                    placeholder={placeholderA}
                                    unit={unit}
                                    locked={!!readOnly}
                                  />
                                </Table.Cell>
                              </Table.Row>
                            )
                          })}
                        </Table.Body>
                      </Table.Root>
                    </Box>

                    {/* Mobile cards */}
                    <Stack gap="3" display={{ base: "flex", md: "none" }}>
                      {METRICS.map(({ key, label, placeholderA, isText }) => {
                        const row = (value as any)?.[key] as ABC | undefined
                        const unit = isText ? undefined : UNIT[key]
                        return (
                          <Card.Root key={String(key)} variant="elevated" overflow="hidden">
                            <Card.Body gap="3">
                              <HStack gap="2">
                                <Box
                                  w="6px"
                                  h="18px"
                                  bg={isText ? "purple.5" : "blue.5"}
                                  borderRadius="full"
                                />
                                <Text fontWeight="medium">{label}</Text>
                              </HStack>
                              <HStack gap="2">
                                <Badge
                                  colorPalette="green"
                                  variant="solid"
                                  minW="28px"
                                  textAlign="center"
                                >
                                  A
                                </Badge>
                                <UnitInput
                                  value={row?.A ?? ""}
                                  onChange={(v) => setCell(key, "A", v)}
                                  placeholder={placeholderA}
                                  unit={unit}
                                  locked={!!readOnly}
                                />
                              </HStack>
                            </Card.Body>
                          </Card.Root>
                        )
                      })}
                    </Stack>
                  </SimpleGrid>
                </Stack>
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Card.Body>
        </Card.Root>
      </Accordion.Item>
    </Accordion.Root>
  )
}

/** deterministic index for zebra coloring */
function idxFromKey(key: keyof DairyQualityStandards): number {
  const order = METRICS.map((m) => m.key)
  return Math.max(0, order.indexOf(key))
}
