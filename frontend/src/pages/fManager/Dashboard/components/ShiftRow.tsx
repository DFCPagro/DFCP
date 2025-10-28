import { HStack, Text, Button, Badge } from "@chakra-ui/react";
import type { Shift } from "@/types/farmerOrders"; // new source of truth

export type ShiftRowProps =
  | {
    variant: "create";
    dateISO: string;
    shift: Shift;  // <= lower-case union: "morning" | "afternoon" | ...
    canAdd: boolean;
    onAdd?: () => void;
  }
  | {
    variant: "stats";
    dateISO: string;
    shift: Shift;  // <= same
    counts: { pending: number; ok: number; problem: number };
    onView?: () => void;
  };

/**
 * Shared row for manager dashboard shift lists.
 * - variant="create": shows [Add] button (enabled if canAdd=true).
 * - variant="stats": shows counts + [View] button.
 */
export function ShiftRow(props: ShiftRowProps) {
  const { dateISO, shift } = props;

  return (
    <HStack
      justify="space-between"
      px="3"
      py="2"
      borderWidth="1px"
      borderRadius="md"
      w="full"
    >
      {/* Left side */}
      <Text fontSize="sm" fontWeight="medium">
        {dateISO} · {shift.charAt(0).toUpperCase() + shift.slice(1)}
      </Text>

      {/* Right side depends on variant */}
      {props.variant === "create" ? (
        <Button
          size="sm"
          colorPalette="green"
          onClick={props.onAdd}
          disabled={!props.canAdd}
        >
          Add
        </Button>
      ) : (
        <HStack gap="3">
          <Badge colorPalette="yellow">Pending {props.counts.pending}</Badge>
          <Badge colorPalette="green">Ok {props.counts.ok}</Badge>
          <Badge colorPalette="red">Problem {props.counts.problem}</Badge>
          <Button size="sm" onClick={props.onView}>
            View
          </Button>
        </HStack>
      )}
    </HStack>
  );
}
