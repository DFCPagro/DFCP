import { Dialog, Portal, Field, Input, Tabs, Button, HStack } from "@chakra-ui/react"
import { useUIStore } from "@/store/useUIStore"

export default function ScanDialog() {
  const scanOpen = useUIStore((s) => s.scanOpen)
  const scanMode = useUIStore((s) => s.scanMode)
  const closeScan = useUIStore((s) => s.closeScan)

  return (
    <Dialog.Root open={scanOpen} onOpenChange={(d) => !d.open && closeScan()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="md" borderRadius="2xl">
            <Dialog.Header>
              <Dialog.Title>Scan</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <Tabs.Root value={scanMode} defaultValue="container">
                <Tabs.List>
                  <Tabs.Trigger value="container">Container</Tabs.Trigger>
                  <Tabs.Trigger value="slot">Slot</Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="container">
                  <Field.Root>
                    <Field.Label>Container ID</Field.Label>
                    <Input placeholder="Scan or type container ID" autoFocus />
                  </Field.Root>
                </Tabs.Content>
                <Tabs.Content value="slot">
                  <HStack>
                    <Field.Root>
                      <Field.Label>Shelf ID</Field.Label>
                      <Input placeholder="e.g. A-1-3" />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Slot</Field.Label>
                      <Input placeholder="1..3" />
                    </Field.Root>
                  </HStack>
                </Tabs.Content>
              </Tabs.Root>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={closeScan}>Cancel</Button>
              <Button colorPalette="lime">Submit</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
