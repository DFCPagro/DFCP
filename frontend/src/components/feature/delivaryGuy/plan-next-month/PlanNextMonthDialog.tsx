import * as React from "react";
import { Button, HStack, Dialog, Separator } from "@chakra-ui/react";
import { nextMonthOf, useScheduleStore } from "@/store/scheduleStore";
import { X } from "lucide-react";
import { StyledIconButton } from "@/components/ui/IconButton";
import StepsHeader from "./steps/StepsHeader";
import Step1WeeklyTable from "./steps/Step1WeeklyTable";
import Step2Review from "./steps/Step2Review";
import StepsNav from "./steps/StepsNav";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: (payload: { year: number; month: number; days: number[] }) => void;
};

export default function PlanNextMonthDialog({ open, onClose, onSaved }: Props) {
  const weeklyPattern = useScheduleStore((s) => s.weeklyPattern);
  const setWeeklyPattern = useScheduleStore((s) => s.setWeeklyPattern);
  const saveMonth = useScheduleStore((s) => s.saveMonth);

  // compute next month once
  const today = React.useMemo(() => new Date(), []);
  const { y, m } = React.useMemo(() => nextMonthOf(today), [today]);

  // steps (controlled)
  const [stepIdx, setStepIdx] = React.useState(0);
  const isStep1 = stepIdx === 0;
  const isStep2 = stepIdx === 1;

  // weekly pattern (7 masks), and month preview
  const [pattern, setPattern] = React.useState<number[]>(
    () => (weeklyPattern?.length === 7 ? weeklyPattern : new Array(7).fill(0))
  );
  const [monthArr, setMonthArr] = React.useState<number[]>([]);

  // build preview array for step 2 from weekly pattern
  React.useEffect(() => {
    if (!isStep2) return;
    const len = new Date(y, m, 0).getDate();
    const arr = Array.from({ length: len }, (_, i) => {
      const dow = new Date(y, m - 1, i + 1).getDay();
      return pattern[dow] || 0;
    });
    setMonthArr(arr);
  }, [isStep2, y, m, pattern]);

  const handleSave = () => {
    setWeeklyPattern(pattern);
    const payload = { year: y, month: m, days: monthArr };
    saveMonth({ ...payload, createdAt: Date.now() });
    onSaved?.(payload);
    setStepIdx(0);
  };

  // reset when closing
  React.useEffect(() => {
    if (!open) {
      setStepIdx(0);
      setPattern(weeklyPattern?.length === 7 ? weeklyPattern : new Array(7).fill(0));
      setMonthArr([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      closeOnInteractOutside={false}
      closeOnEscape={false}
      size="xl"
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content position="relative" display="flex" flexDir="column" maxH="100vh">
          {/* Close */}
          <Dialog.CloseTrigger asChild>
            <StyledIconButton aria-label="Close dialog" variant="ghost" size="sm">
              <X />
            </StyledIconButton>
          </Dialog.CloseTrigger>

          {/* Header */}
          <Dialog.Header pb={2}>
            <StepsHeader stepIdx={stepIdx} setStepIdx={setStepIdx} y={y} m={m} />
          </Dialog.Header>

          <Separator />

          {/* Body */}
          <Dialog.Body overflow="auto" pt={4} pb={2}>
            {isStep1 && <Step1WeeklyTable pattern={pattern} setPattern={setPattern} />}

            {isStep2 && (
              <Step2Review y={y} m={m} monthArr={monthArr} setMonthArr={setMonthArr} weekdayTemplate={pattern} />
            )}
          </Dialog.Body>

          <Separator />

          {/* Footer / sticky actions */}
          <Dialog.Footer
            display="flex"
            justifyContent="space-between"
            gap={3}
            position="sticky"
            bottom={0}
            bg="white"
            zIndex={1}
          >
            <HStack>
              <Button variant="ghost" onClick={() => onClose()}>
                Cancel
              </Button>
            </HStack>

            <StepsNav stepIdx={stepIdx} setStepIdx={setStepIdx} onSave={handleSave} />
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
