import * as React from "react"
import {
  Button,
  Dialog,
  HStack,
  Input,
  Portal,
  Table,
  Text,
} from "@chakra-ui/react"

type ABC = { A?: string | null; B?: string | null; C?: string | null }
type QualityStandards = {
  brix?: ABC
  acidityPercentage?: ABC
  pressure?: ABC
  colorDescription?: ABC
  colorPercentage?: ABC
  weightPerUnit?: ABC
  weightPerUnitG?: ABC
  diameterMM?: ABC
  qualityGrade?: ABC
  maxDefectRatioLengthDiameter?: ABC
  rejectionRate?: ABC
  tolerance?: ABC
}

type Props = {
  open: boolean
  setOpen: (open: boolean) => void
  /** Current value from the form (can be undefined) */
  value?: QualityStandards | undefined
  /** Save handler: writes back into the form */
  onChange: (next: QualityStandards | undefined) => void
}

const METRICS = [
  { key: "brix", label: "Brix" },
  { key: "acidityPercentage", label: "Acidity %" },
  { key: "pressure", label: "Pressure" },
  { key: "colorDescription", label: "Color (desc.)" },
  { key: "colorPercentage", label: "Color %" },
  { key: "weightPerUnit", label: "Weight/unit (g)" },
  { key: "diameterMM", label: "Diameter (mm)" },
  { key: "qualityGrade", label: "Quality grade" },
  { key: "maxDefectRatioLengthDiameter", label: "Max defect ratio L/D" },
  { key: "rejectionRate", label: "Rejection rate" },
] as const

export default function QualityStandardsEditorDialog({
  open,
  setOpen,
  value,
  onChange,
}: Props) {
  // make an isolated draft so cancel doesn't mutate the form
  const [draft, setDraft] = React.useState<QualityStandards | undefined>(value)

  // reload draft whenever dialog opens with a new value
  React.useEffect(() => {
    if (open) setDraft(value ? structuredClone(value) : undefined)
  }, [open, value])

  const setCell = (metricKey: keyof QualityStandards, grade: keyof ABC, v: string) => {
    setDraft((prev) => {
      const next: QualityStandards = { ...(prev ?? {}) }
      const row: ABC = { ...(next[metricKey] ?? {}) }
      row[grade] = v || undefined
      // clean empty rows
      if (!row.A && !row.B && !row.C) {
        delete (next as any)[metricKey]
      } else {
        ;(next as any)[metricKey] = row
      }
      return next
    })
  }

  const clearAll = () => setDraft(undefined)

  const filledCount = React.useMemo(() => {
    const q = draft ?? {}
    let count = 0
    for (const k of Object.keys(q)) {
      const row = (q as any)[k] as ABC
      if (row?.A || row?.B || row?.C) count++
    }
    return count
  }, [draft])

  return (
    <Dialog.Root
      open={open}
      onOpenChange={({ open }) => setOpen(open)}
      size="lg"
      placement="center"
      restoreFocus
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="min(780px, 96vw)">
            <Dialog.Header>
              <HStack justify="space-between" w="full">
                <Text>Quality standards</Text>
                <HStack gap="2">
                  <Button variant="ghost" size="sm" onClick={clearAll}>
                    Clear all
                  </Button>
                </HStack>
              </HStack>
            </Dialog.Header>

            <Dialog.Body>
              <Table.ScrollArea maxH="420px">
                <Table.Root size="sm" variant="outline">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Metric</Table.ColumnHeader>
                      <Table.ColumnHeader>A</Table.ColumnHeader>
                      <Table.ColumnHeader>B</Table.ColumnHeader>
                      <Table.ColumnHeader>C</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {METRICS.map(({ key, label }) => {
                      const row = (draft as any)?.[key] as ABC | undefined
                      return (
                        <Table.Row key={key}>
                          <Table.Cell>
                            <Text fontWeight="medium">{label}</Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Input
                              size="sm"
                              value={row?.A ?? ""}
                              onChange={(e) => setCell(key, "A", e.target.value)}
                              placeholder="A"
                            />
                          </Table.Cell>
                          <Table.Cell>
                            <Input
                              size="sm"
                              value={row?.B ?? ""}
                              onChange={(e) => setCell(key, "B", e.target.value)}
                              placeholder="B"
                            />
                          </Table.Cell>
                          <Table.Cell>
                            <Input
                              size="sm"
                              value={row?.C ?? ""}
                              onChange={(e) => setCell(key, "C", e.target.value)}
                              placeholder="C"
                            />
                          </Table.Cell>
                        </Table.Row>
                      )
                    })}
                  </Table.Body>
                </Table.Root>
              </Table.ScrollArea>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack justify="space-between" w="full">
                <Text fontSize="sm" color="fg.muted">
                  {filledCount} metric{filledCount === 1 ? "" : "s"} set
                </Text>
                <HStack>
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    colorPalette="teal"
                    onClick={() => {
                      // normalize empty object to undefined
                      const normalized =
                        draft && Object.keys(draft).length > 0 ? draft : undefined
                      onChange(normalized)
                      setOpen(false)
                    }}
                  >
                    Save
                  </Button>
                </HStack>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
