import * as React from "react";
import { Icon, IconButton, Tooltip } from "@chakra-ui/react";
import { RefreshCw } from "lucide-react";

export default function HeaderActions({ onRefresh }: { onRefresh: () => void }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <IconButton aria-label="refresh" size="sm" variant="ghost" onClick={onRefresh}>
          <Icon as={RefreshCw} />
        </IconButton>
      </Tooltip.Trigger>
      <Tooltip.Positioner>
        <Tooltip.Content>
          Refresh
          <Tooltip.Arrow />
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
}
