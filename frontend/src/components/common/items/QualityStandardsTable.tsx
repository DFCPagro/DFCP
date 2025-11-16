import {
  Accordion,
  Badge,
  Box,
  Card,
  Field,
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

export type QualityStandards = {
  brix?: ABC
  acidityPercentage?: ABC
  pressure?: ABC
  colorDescription?: ABC
  colorPercentage?: ABC
  weightPerUnit?: ABC
  diameterMM?: ABC
  qualityGrade?: ABC
  maxDefectRatioLengthDiameter?: ABC
  rejectionRate?: ABC
}

type Props = {
  value?: QualityStandards | undefined
  onChange: (next: QualityStandards | undefined) => void
  readOnly?: boolean
  /** top-level product tolerance (e.g., "0.02") */
  tolerance?: string | null
  onChangeTolerance?: (next: string | null) => void
}

/** Unit chips shown to the right of inputs. */
const UNIT: Partial<Record<keyof QualityStandards, string>> = {
  brix: "%",
  acidityPercentage: "%",
  pressure: "kg/cm²",
  colorPercentage: "%",
  weightPerUnit: "g",
  diameterMM: "mm",
  maxDefectRatioLengthDiameter: "%",
  rejectionRate: "%",
}

/** Labels + example placeholders (without units since units are chips). */
const METRICS: Array<{
  key: keyof QualityStandards
  label: string
  placeholderA?: string
  placeholderB?: string
  placeholderC?: string
  isText?: boolean // free text (no numeric expectation)
}> = [
  { key: "brix", label: "Brix (sugar)", placeholderA: "13+", placeholderB: "11–12.9", placeholderC: "9–10.9" },
  { key: "acidityPercentage", label: "Acidity %", placeholderA: "0.4–0.6", placeholderB: "0.3–0.39", placeholderC: "<0.3" },
  { key: "pressure", label: "Firmness / Pressure", placeholderA: "7.5", placeholderB: "6–7.4", placeholderC: "<6" },
  { key: "colorDescription", label: "Color (description)", placeholderA: "Bright coloration", placeholderB: "Moderate coloration", placeholderC: "Pale / uneven", isText: true },
  { key: "colorPercentage", label: "Color % coverage", placeholderA: "85–100", placeholderB: "60–84", placeholderC: "<60" },
  { key: "weightPerUnit", label: "Weight per unit", placeholderA: "180+", placeholderB: "150–179", placeholderC: "<150" },
  { key: "diameterMM", label: "Diameter (mm)", placeholderA: "75+", placeholderB: "65–74", placeholderC: "<65" },
  { key: "qualityGrade", label: "Quality grade (text)", placeholderA: "Premium", placeholderB: "Standard", placeholderC: "Below Standard", isText: true },
  { key: "maxDefectRatioLengthDiameter", label: "Max defect ratio (L/D)", placeholderA: "≤3", placeholderB: "≤5", placeholderC: "≤7" },
  { key: "rejectionRate", label: "Rejection rate %", placeholderA: "≤2", placeholderB: "≤4", placeholderC: "≤6" },
]

/**
 * Fully locked input (no focus, no typing) while keeping normal colors.
 * We use `disabled` (blocks click/edit) + override `_disabled` styles to avoid dimming.
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
      // keep visual style normal when disabled (no opacity drop)
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
      <LockedInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        locked={locked}
      />
      {unit ? (
        <Badge variant="subtle" flexShrink={0}>
          {unit}
        </Badge>
      ) : null}
    </HStack>
  )
}

export default function QualityStandardsSection({
  value,
  onChange,
  readOnly,
  tolerance,
  onChangeTolerance,
}: Props) {
  const setCell = (metricKey: keyof QualityStandards, grade: keyof ABC, v: string) => {
    if (readOnly) return
    const next: QualityStandards = { ...(value ?? {}) }
    const row: ABC = { ...(next[metricKey] ?? {}) }
    row[grade] = v || undefined
    if (!row.A && !row.B && !row.C) {
      delete (next as any)[metricKey]
    } else {
      ;(next as any)[metricKey] = row
    }
    onChange(Object.keys(next).length ? next : undefined)
  }

  const setTol = (v: string) => {
    if (!onChangeTolerance || readOnly) return
    const t = v.trim()
    onChangeTolerance(t.length ? t : null)
  }

  return (
    <Accordion.Root defaultValue={["qs"]} multiple collapsible>
      <Accordion.Item value="qs">
        <Card.Root variant="outline" overflow="hidden">
          <Card.Body p="0">
            {/* Header */}
            <Box px="4" py="3" bgGradient="to-r" gradientFrom="bg" gradientTo="bg.subtle">
              <HStack justifyContent="space-between" wrap="wrap" gap="3">
                {/* Trigger acts exactly like the previous example (button inside ItemTrigger) */}
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
                    <Tag.Label>Quality Standards — A / B / C</Tag.Label>
                    <Accordion.ItemIndicator />
                  </Tag.Root>
                </Accordion.ItemTrigger>

                <HStack gap="2" wrap="wrap">
                  <Tooltip content="Allowed tolerance used when validating measured values across the system.">
                    <HStack gap="1">
                      <LuInfo />
                      <Text fontSize="sm" color="fg.muted">Tolerance</Text>
                    </HStack>
                  </Tooltip>
                  <Tag.Root colorPalette="green" variant="subtle">
                    <Tag.Label>{tolerance ?? "0.02"} (≈ {Math.round(Number(tolerance ?? "0.02") * 100)}%)</Tag.Label>
                  </Tag.Root>
                </HStack>
              </HStack>
            </Box>

            <Accordion.ItemContent>
              <Accordion.ItemBody>
                <Stack gap="5" px="4" py="4">
                  {/* Editable tolerance with locked visuals */}
                  <Field.Root>
                    <Field.Label>Set tolerance ratio</Field.Label>
                    <HStack gap="2" align="center" w="full" maxW="360px">
                      <LockedInput
                        value={tolerance ?? ""}
                        onChange={(v) => setTol(v)}
                        placeholder="0.02"
                        locked={!!readOnly}
                      />
                      <Badge variant="subtle" flexShrink={0}>ratio</Badge>
                      <Text color="fg.muted" fontSize="xs">0.02 = 2%</Text>
                    </HStack>
                  </Field.Root>

                  <Separator />

                  {/* Same process: user fills values directly in the table */}
                  <SimpleGrid columns={{ base: 1, md: 1 }} gap="4">
                    {/* Desktop table */}
                    <Box display={{ base: "none", md: "block" }} overflowX="auto">
                      <Table.Root size="sm" variant="outline" minW="900px">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeader w="28%">Metric</Table.ColumnHeader>
                            <Table.ColumnHeader w="24%">
                              <HStack gap="2">
                                <Badge colorPalette="green" variant="solid">A</Badge>
                                <Text fontWeight="medium">Best</Text>
                              </HStack>
                            </Table.ColumnHeader>
                            <Table.ColumnHeader w="24%">
                              <HStack gap="2">
                                <Badge colorPalette="yellow" variant="solid">B</Badge>
                                <Text fontWeight="medium">Acceptable</Text>
                              </HStack>
                            </Table.ColumnHeader>
                            <Table.ColumnHeader w="24%">
                              <HStack gap="2">
                                <Badge colorPalette="red" variant="solid">C</Badge>
                                <Text fontWeight="medium">Minimum</Text>
                              </HStack>
                            </Table.ColumnHeader>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {METRICS.map(({ key, label, placeholderA, placeholderB, placeholderC, isText }) => {
                            const row = (value as any)?.[key] as ABC | undefined
                            const unit = isText ? undefined : UNIT[key]
                            const zebra = (idxFromKey(key) % 2) === 0
                            return (
                              <Table.Row key={String(key)} bg={zebra ? "bg" : "bg.subtle"}>
                                <Table.Cell>
                                  <HStack gap="2">
                                    <Box w="6px" h="18px" bg={isText ? "purple.5" : "blue.5"} borderRadius="full" />
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
                                <Table.Cell>
                                  <UnitInput
                                    value={row?.B ?? ""}
                                    onChange={(v) => setCell(key, "B", v)}
                                    placeholder={placeholderB}
                                    unit={unit}
                                    locked={!!readOnly}
                                  />
                                </Table.Cell>
                                <Table.Cell>
                                  <UnitInput
                                    value={row?.C ?? ""}
                                    onChange={(v) => setCell(key, "C", v)}
                                    placeholder={placeholderC}
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

                    {/* Mobile cards (same data, stacked) */}
                    <Stack gap="3" display={{ base: "flex", md: "none" }}>
                      {METRICS.map(({ key, label, placeholderA, placeholderB, placeholderC, isText }) => {
                        const row = (value as any)?.[key] as ABC | undefined
                        const unit = isText ? undefined : UNIT[key]
                        return (
                          <Card.Root key={String(key)} variant="elevated" overflow="hidden">
                            <Card.Body gap="3">
                              <HStack gap="2">
                                <Box w="6px" h="18px" bg={isText ? "purple.5" : "blue.5"} borderRadius="full" />
                                <Text fontWeight="medium">{label}</Text>
                              </HStack>
                              <Stack gap="2">
                                <HStack gap="2">
                                  <Badge colorPalette="green" variant="solid" minW="28px" textAlign="center">A</Badge>
                                  <UnitInput
                                    value={row?.A ?? ""}
                                    onChange={(v) => setCell(key, "A", v)}
                                    placeholder={placeholderA}
                                    unit={unit}
                                    locked={!!readOnly}
                                  />
                                </HStack>
                                <HStack gap="2">
                                  <Badge colorPalette="yellow" variant="solid" minW="28px" textAlign="center">B</Badge>
                                  <UnitInput
                                    value={row?.B ?? ""}
                                    onChange={(v) => setCell(key, "B", v)}
                                    placeholder={placeholderB}
                                    unit={unit}
                                    locked={!!readOnly}
                                  />
                                </HStack>
                                <HStack gap="2">
                                  <Badge colorPalette="red" variant="solid" minW="28px" textAlign="center">C</Badge>
                                  <UnitInput
                                    value={row?.C ?? ""}
                                    onChange={(v) => setCell(key, "C", v)}
                                    placeholder={placeholderC}
                                    unit={unit}
                                    locked={!!readOnly}
                                  />
                                </HStack>
                              </Stack>
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
function idxFromKey(key: keyof QualityStandards): number {
  const order = METRICS.map((m) => m.key)
  return Math.max(0, order.indexOf(key))
}
