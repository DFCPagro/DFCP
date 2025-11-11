import * as React from "react"
import {
  Badge,
  Box,
  Card,
  HStack,
  Input,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react"
import DairyQualityStandardsSection from "@/components/common/items/DairyQualityStandards"
import { Reveal } from "./Animated"

/**
 * Local metric model (decoupled from external DairyQualityStandards type)
 * to avoid TS errors like "Property 'measures' does not exist on type ...".
 */
type MetricKey =
  | "fat"
  | "protein"
  | "lactose"
  | "snf"
  | "freezingPoint"
  | "density"
  | "ph"
  | "somaticCellCount"
  | "bacterialCount"

type Measurements = Partial<Record<MetricKey, number | string>>

const metricLabels: Record<MetricKey, string> = {
  fat: "Fat %",
  protein: "Protein %",
  lactose: "Lactose %",
  snf: "SNF %",
  freezingPoint: "Freezing point",
  density: "Density",
  ph: "pH",
  somaticCellCount: "Somatic cell count",
  bacterialCount: "Bacterial count",
}

type Props = {
  readOnly?: boolean
}

export default function DairyQualityStandardsPanel(props: Props) {
  // We keep an internal shape that matches our grid needs.
  // The external shared component is typed as `any` to prevent type coupling.
  const [qsExample, setQsExample] = React.useState<any | undefined>()
  const [measured, setMeasured] = React.useState<Measurements | undefined>()

  const metricKeys = React.useMemo(() => Object.keys(metricLabels) as MetricKey[], [])

  const onChangeNumber = React.useCallback(
    (key: MetricKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const clean = e.currentTarget.value
      setMeasured((prev) => ({ ...(prev ?? {}), [key]: clean }))
    },
    []
  )

  const onBlurFormat = React.useCallback(
    (key: MetricKey) => (e: React.FocusEvent<HTMLInputElement>) => {
      const raw = e.currentTarget.value
      const clean = raw.trim()
      setMeasured((prev) => {
        const next = { ...(prev ?? {}) }
        if (!clean) {
          delete next[key]
        } else {
          next[key] = clean
        }
        return Object.keys(next).length ? next : undefined
      })
    },
    []
  )

  return (
    <Stack gap="5">
      {/* 1) READ-ONLY examples */}
      <Reveal>
        <Card.Root className="anim-pressable" variant="outline" overflow="hidden">
          <Card.Body>
            <DairyQualityStandardsSection
              value={qsExample as any}
              onChange={(v: any) => setQsExample(v)}
              readOnly
            />
          </Card.Body>
        </Card.Root>
      </Reveal>

      {/* 2) Editable measurements grid */}
      <Reveal>
        <Card.Root className="anim-pressable" variant="outline" overflow="hidden">
          <Card.Header>
            <HStack justify="space-between">
              <Text fontWeight="semibold" color="fg.subtle">
                Measurements — Enter actual values
              </Text>
              <Badge>Live</Badge>
            </HStack>
          </Card.Header>

          <Card.Body>
            <Box overflowX="auto" pt="1">
              <Table.Root size="sm" variant="outline" minW="720px">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader w="34%">Field</Table.ColumnHeader>
                    <Table.ColumnHeader w="48%">Measured</Table.ColumnHeader>
                    <Table.ColumnHeader w="18%">Unit</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {metricKeys.map((key) => {
                    const label = metricLabels[key]
                    return (
                      <Table.Row key={key}>
                        <Table.Cell>
                          <Text>{label}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Input
                            className="anim-scale-hover"
                            size="sm"
                            value={(measured?.[key] as string) ?? ""}
                            onChange={onChangeNumber(key)}
                            onBlur={onBlurFormat(key)}
                            placeholder="Enter value"
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Text color="fg.muted">—</Text>
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table.Root>
            </Box>
          </Card.Body>

          <Card.Footer>
            <Text fontSize="xs" color="fg.muted">
              Tip: fields left blank will be ignored.
            </Text>
          </Card.Footer>
        </Card.Root>
      </Reveal>
    </Stack>
  )
}
