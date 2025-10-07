import {
  Accordion,
  Badge,
  Box,
  HStack,
  Input,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react"

type ABC = { A?: string | null; B?: string | null; C?: string | null }
export type QualityStandards = {
  tolerance?: ABC
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
}

/** Unit chips shown to the right of inputs (so units are not inside the field). */
const UNIT: Partial<Record<keyof QualityStandards, string>> = {
  tolerance: "%",
  brix: "%",
  acidityPercentage: "%",
  pressure: "kg/cm²",
  colorPercentage: "%",
  weightPerUnit: "g",
  diameterMM: "mm",
  maxDefectRatioLengthDiameter: "%",
  rejectionRate: "%",
}

/** Labels + example placeholders (without units since units are shown as chips). */
const METRICS: Array<{
  key: keyof QualityStandards
  label: string
  placeholderA?: string
  placeholderB?: string
  placeholderC?: string
  isText?: boolean // free text (no numeric expectation)
}> = [
  { key: "tolerance", label: "tolerance", placeholderA: "", placeholderB: "", placeholderC: "" },
  { key: "brix", label: "brix", placeholderA: "13+", placeholderB: "11–12.9", placeholderC: "9–10.9" },
  {
    key: "acidityPercentage",
    label: "acidityPercentage",
    placeholderA: "0.4–0.6",
    placeholderB: "0.3–0.39",
    placeholderC: "<0.3",
  },
  { key: "pressure", label: "pressure", placeholderA: "7.5", placeholderB: "6–7.4", placeholderC: "<6" },
  {
    key: "colorDescription",
    label: "colorDescription",
    placeholderA: "Bright coloration",
    placeholderB: "Moderate coloration",
    placeholderC: "Pale or uneven coloration",
    isText: true,
  },
  { key: "colorPercentage", label: "colorPercentage", placeholderA: "85–100", placeholderB: "60–84", placeholderC: "<60" },
  { key: "weightPerUnit", label: "weightPerUnit", placeholderA: "180+", placeholderB: "150–179", placeholderC: "<150" },
  { key: "diameterMM", label: "diameterMM", placeholderA: "75+", placeholderB: "65–74", placeholderC: "<65" },
  { key: "qualityGrade", label: "qualityGrade", placeholderA: "Premium", placeholderB: "Standard", placeholderC: "Below Standard", isText: true },
  { key: "maxDefectRatioLengthDiameter", label: "maxDefectRatioLengthDiameter", placeholderA: "≤3", placeholderB: "≤5", placeholderC: "≤7" },
  { key: "rejectionRate", label: "rejectionRate", placeholderA: "≤2", placeholderB: "≤4", placeholderC: "≤6" },
]

function UnitInput({
  value,
  onChange,
  placeholder,
  unit,
  readOnly,
}: {
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  unit?: string
  readOnly?: boolean
}) {
  return (
    <HStack gap="2" align="center">
      <Input
        size="sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={readOnly}
      />
      {unit ? (
        <Badge variant="subtle" flexShrink={0}>
          {unit}
        </Badge>
      ) : null}
    </HStack>
  )
}

export default function QualityStandardsSection({ value, onChange, readOnly }: Props) {
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

  return (
    <Accordion.Root defaultValue={["qs"]} multiple>
      <Accordion.Item value="qs">
        <Accordion.ItemTrigger py="2" px="3" _hover={{ bg: "blackAlpha.50" }} borderRadius="md">
          <Text fontWeight="semibold">Quality Standards</Text>
        </Accordion.ItemTrigger>
        <Accordion.ItemContent>
          <Box pt="3">
            {/* Mobile (stacked) */}
            <Stack gap="3" display={{ base: "flex", md: "none" }}>
              {METRICS.map(({ key, label, placeholderA, placeholderB, placeholderC, isText }) => {
                const row = (value as any)?.[key] as ABC | undefined
                const unit = isText ? undefined : UNIT[key]
                return (
                  <Box key={String(key)} borderWidth="1px" borderRadius="md" p="3">
                    <Text fontWeight="medium" mb="2">
                      {label}
                    </Text>
                    <Stack gap="2">
                      <UnitInput
                        value={row?.A ?? ""}
                        onChange={(v) => setCell(key, "A", v)}
                        placeholder={placeholderA}
                        unit={unit}
                        readOnly={readOnly}
                      />
                      <UnitInput
                        value={row?.B ?? ""}
                        onChange={(v) => setCell(key, "B", v)}
                        placeholder={placeholderB}
                        unit={unit}
                        readOnly={readOnly}
                      />
                      <UnitInput
                        value={row?.C ?? ""}
                        onChange={(v) => setCell(key, "C", v)}
                        placeholder={placeholderC}
                        unit={unit}
                        readOnly={readOnly}
                      />
                    </Stack>
                  </Box>
                )
              })}
            </Stack>

            {/* Desktop (table). Force a min width so it scrolls horizontally instead of squishing. */}
            <Box display={{ base: "none", md: "block" }} overflowX="auto">
              <Table.Root size="sm" variant="outline" minW="820px">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader w="32%">Field</Table.ColumnHeader>
                    <Table.ColumnHeader w="22%">A</Table.ColumnHeader>
                    <Table.ColumnHeader w="22%">B</Table.ColumnHeader>
                    <Table.ColumnHeader w="22%">C</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {METRICS.map(({ key, label, placeholderA, placeholderB, placeholderC, isText }) => {
                    const row = (value as any)?.[key] as ABC | undefined
                    const unit = isText ? undefined : UNIT[key]
                    return (
                      <Table.Row key={String(key)}>
                        <Table.Cell>
                          <Text fontWeight="medium">{label}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <UnitInput
                            value={row?.A ?? ""}
                            onChange={(v) => setCell(key, "A", v)}
                            placeholder={placeholderA}
                            unit={unit}
                            readOnly={readOnly}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <UnitInput
                            value={row?.B ?? ""}
                            onChange={(v) => setCell(key, "B", v)}
                            placeholder={placeholderB}
                            unit={unit}
                            readOnly={readOnly}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <UnitInput
                            value={row?.C ?? ""}
                            onChange={(v) => setCell(key, "C", v)}
                            placeholder={placeholderC}
                            unit={unit}
                            readOnly={readOnly}
                          />
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table.Root>
            </Box>
          </Box>
        </Accordion.ItemContent>
      </Accordion.Item>
    </Accordion.Root>
  )
}
