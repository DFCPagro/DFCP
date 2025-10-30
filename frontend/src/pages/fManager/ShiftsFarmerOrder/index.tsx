import { useAuthStore } from "@/store/auth";
import { Button, Heading, Text, VStack } from "@chakra-ui/react";
import { ShiftEnum, IsoDateString, isValidShift } from "@/types/shifts";
import { useSearchParams } from "react-router-dom";

export default function ShiftsFarmerOrder() {
  const [search, setSearch] = useSearchParams();

  // Parse query params safely
  const dateParam = (search.get("date") || "") as IsoDateString;
  const shiftParam = search.get("shift");
  const shift = isValidShift(shiftParam) ? (shiftParam as ShiftEnum) : undefined;


  return (
    <VStack gap={4} mt={16}>
      <Heading size="md">Shifts Farmer Order</Heading>

    </VStack>
  );
}
