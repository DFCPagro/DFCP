import * as React from "react";
import { Card, HStack, Heading, Spinner, Alert, Button } from "@chakra-ui/react";
import type { ShiftName } from "@/api/shifts";

export default function ShiftStrip({
  shifts,
  selected,
  onSelect,
  isLoading,
  errorMsg,
}: {
  shifts: Array<{ shiftName: Exclude<ShiftName, "none">; shiftDate: string; label: string }>;
  selected: { shiftName: Exclude<ShiftName, "none">; shiftDate: string } | null;
  onSelect: (s: { shiftName: Exclude<ShiftName, "none">; shiftDate: string }) => void;
  isLoading?: boolean;
  errorMsg?: string | null;
}) {
  return (
    <Card.Root>
      <Card.Header>
        <HStack justify="space-between">
          <Heading size="md">Shifts (current + 5)</Heading>
          {isLoading && <Spinner size="sm" />}
        </HStack>
      </Card.Header>
      <Card.Body>
        {errorMsg && (
          <Alert.Root status="error" mb={4}>
            <Alert.Description>{errorMsg}</Alert.Description>
          </Alert.Root>
        )}
        <HStack wrap="wrap" gap={3}>
          {shifts.map((s) => {
            const isActive = selected?.shiftName === s.shiftName && selected?.shiftDate === s.shiftDate;
            return (
              <Button
                key={`${s.shiftDate}_${s.shiftName}`}
                variant={isActive ? "solid" : "outline"}
                onClick={() => onSelect({ shiftName: s.shiftName, shiftDate: s.shiftDate })}
                size="sm"
              >
                {s.label}
              </Button>
            );
          })}
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}
