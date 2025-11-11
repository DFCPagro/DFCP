import { HStack, Text, Button, Badge } from "@chakra-ui/react";
import type { ShiftEnum as Shift } from "@/types/shifts";

// Helper → formats "2025-11-11" → "Tuesday"
function getDayOfWeek(dateISO: string) {
  try {
    const date = new Date(dateISO);
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
  } catch {
    return "";
  }
}

export type ShiftRowProps =
  | {
      variant: "create";
      dateISO: string;
      shift: Shift;
      canAdd: boolean;
      onAdd?: () => void;
    }
  | {
      variant: "stats";
      dateISO: string;
      shift: Shift;
      counts: { pending: number; ok: number; problem: number };
      onView?: () => void;
    };

export function ShiftRow(props: ShiftRowProps) {
  const { dateISO, shift } = props;
  const dayName = getDayOfWeek(dateISO);

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
        {dateISO} · {dayName} · {shift.charAt(0).toUpperCase() + shift.slice(1)}
      </Text>

      {/* Right side */}
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
