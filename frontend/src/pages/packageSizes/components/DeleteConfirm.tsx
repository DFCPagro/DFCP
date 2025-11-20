import { useState } from "react";
import { Dialog, Flex, Heading, Text, Button, Stack } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";

type Mode = "package" | "container";

type Props = {
  idOrKey: string | null;
  mode: Mode;
  onConfirm(idOrKey: string): Promise<void> | void;
  onClose(): void;
};

export default function DeleteConfirm({ idOrKey, mode, onConfirm, onClose }: Props) {
  const [loading, setLoading] = useState(false);

  const label = mode === "package" ? "package size" : "container";

  const handleDelete = async () => {
    if (!idOrKey) return;
    setLoading(true);
    try {
      await onConfirm(idOrKey);
      toaster.create({
        type: "success",
        title: "Deleted",
        description: `${label.charAt(0).toUpperCase() + label.slice(1)} "${idOrKey}" removed.`,
      });
      onClose();
    } catch (e: any) {
      toaster.create({
        type: "error",
        title: "Failed to delete",
        description: e?.response?.data?.message ?? e?.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={!!idOrKey} onOpenChange={(e) => !e.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content rounded="2xl" p="6" maxW="md">
          <Stack gap="4">
            <Dialog.CloseTrigger />
            <Heading size="lg">Delete {label}?</Heading>
            <Text color="fg.muted">
              This action cannot be undone. Are you sure you want to permanently delete{" "}
              <Text as="span" fontWeight="semibold">
                {idOrKey}
              </Text>
              ?
            </Text>
            <Flex justify="flex-end" gap="3" mt="2">
              <Button variant="subtle" onClick={onClose}>
                Cancel
              </Button>
              <Button colorPalette="red" loading={loading} onClick={handleDelete}>
                Delete
              </Button>
            </Flex>
          </Stack>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
