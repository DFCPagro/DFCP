import { VStack } from "@chakra-ui/react";
import MonthGrid from "@/components/feature/delivaryGuy/month-grid/";

export default function MonthReview({
  y,
  m,
  monthArr,
  setMonthArr,
  weekdayTemplate,
}: {
  y: number;
  m: number;
  monthArr: number[];
  setMonthArr: (next: number[]) => void;
  weekdayTemplate: number[];
}) {
  return (
    <VStack align="stretch" gap={3}>
      <MonthGrid
        hideBorder
        removePadding
        year={y}
        month={m}
        days={monthArr}
        editable
        onDaysChange={setMonthArr}
        weekdayTemplate={weekdayTemplate}
        showActions
      />
    </VStack>
  );
}
