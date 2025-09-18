import {
  Badge,
  Box,
  HStack,
  Table,
  Dialog,
  Portal,
  useDisclosure,
} from "@chakra-ui/react"
import { Info } from "lucide-react"
import type { Item } from "@/types/items"
import { StyledIconButton } from "@/components/ui/IconButton"

type Props = { item: Item }

type ABC =
  | {
      A?: string | null
      B?: string | null
      C?: string | null
    }
  | undefined

function Row({ label, abc }: { label: string; abc: ABC }) {
  const A = (abc as any)?.A ?? "-"
  const B = (abc as any)?.B ?? "-"
  const C = (abc as any)?.C ?? "-"
  if (A === "-" && B === "-" && C === "-") return null
  return (
    <Table.Row>
      <Table.Cell>
        <Box fontWeight="medium">{label}</Box>
      </Table.Cell>
      <Table.Cell>
        <Badge variant="subtle">{A}</Badge>
      </Table.Cell>
      <Table.Cell>
        <Badge variant="subtle">{B}</Badge>
      </Table.Cell>
      <Table.Cell>
        <Badge variant="subtle">{C}</Badge>
      </Table.Cell>
    </Table.Row>
  )
}

export default function QualityStandardsDialog({ item }: Props) {
  const qs: any = item.qualityStandards || {}
  const showAnything =
    !!qs?.brix ||
    !!qs?.acidityPercentage ||
    !!qs?.pressure ||
    !!qs?.colorDescription ||
    !!qs?.colorPercentage ||
    !!qs?.weightPerUnit ||
    !!qs?.weightPerUnitG ||
    !!qs?.diameterMM ||
    !!qs?.qualityGrade ||
    !!qs?.maxDefectRatioLengthDiameter ||
    !!qs?.rejectionRate

  const dialog = useDisclosure()

  if (!showAnything) return <Box color="fg.muted">-</Box>

  return (
    <>
      <StyledIconButton
        aria-label="View quality standards"
        size="xs"
        variant="subtle"
        onClick={dialog.onOpen}
      >
        <Info size={14} />
      </StyledIconButton>

      <Dialog.Root
        open={dialog.open}
        onOpenChange={({ open }) => dialog.setOpen(open)}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="min(640px, 96vw)">
              <Dialog.Header>Quality standards</Dialog.Header>

              <Dialog.Body>
                <Table.ScrollArea maxH="360px">
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
                      <Row label="Brix" abc={qs.brix} />
                      <Row label="Acidity %" abc={qs.acidityPercentage} />
                      <Row label="Pressure" abc={qs.pressure} />
                      <Row label="Color (desc.)" abc={qs.colorDescription} />
                      <Row label="Color %" abc={qs.colorPercentage} />
                      <Row
                        label="Weight/unit (g)"
                        abc={qs.weightPerUnit ?? qs.weightPerUnitG}
                      />
                      <Row label="Diameter (mm)" abc={qs.diameterMM} />
                      <Row label="Quality grade" abc={qs.qualityGrade} />
                      <Row
                        label="Max defect ratio L/D"
                        abc={qs.maxDefectRatioLengthDiameter}
                      />
                      <Row label="Rejection rate" abc={qs.rejectionRate} />
                    </Table.Body>
                  </Table.Root>
                </Table.ScrollArea>

                {(qs.tolerance?.A || qs.tolerance?.B || qs.tolerance?.C) && (
                  <Box px={3} py={2} color="fg.muted" borderTopWidth="1px">
                    <HStack gap={2}>
                      <Box fontWeight="medium">Tolerance:</Box>
                      <Box>
                        A: {qs.tolerance?.A ?? "-"} / B: {qs.tolerance?.B ?? "-"} / C:{" "}
                        {qs.tolerance?.C ?? "-"}
                      </Box>
                    </HStack>
                  </Box>
                )}
              </Dialog.Body>

              <Dialog.Footer>
                <StyledIconButton
                  aria-label="Close"
                  variant="ghost"
                  onClick={dialog.onClose}
                >
                  Close
                </StyledIconButton>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  )
}
