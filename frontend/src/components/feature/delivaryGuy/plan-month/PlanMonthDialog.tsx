import * as React from "react";
import { Button, HStack, Dialog, Separator, Heading } from "@chakra-ui/react";
import { X } from "lucide-react";
import { StyledIconButton } from "@/components/ui/IconButton";
import Step1WeeklyTable from "./Step1WeeklyTable";
import MonthReview from "./MonthReview";
import { nextMonthOf, useScheduleStore } from "@/store/scheduleStore";

type Role = "X" | "Y";

type Props = {
  open: boolean;
  onClose: () => void;
  role: Role; // NEW: which single-screen to show
  onSaved?: (payload: { year: number; month: number; days: number[] }) => void;
};

export default function PlanMonthDialog({
  open,
  onClose,
  role,
  onSaved,
}: Props) {
  const weeklyPattern = useScheduleStore((s) => s.weeklyPattern);
  const setWeeklyPattern = useScheduleStore((s) => s.setWeeklyPattern);
  const saveMonth = useScheduleStore((s) => s.saveMonth);
  // compute next month once
  const today = React.useMemo(() => new Date(), []);
  const { y, m } = React.useMemo(() => nextMonthOf(today), [today]);

  // which single screen are we showing?
  const isWeeklyEditor = role === "X"; // show Step 1 (weekly pattern)
  const isReviewEditor = role === "Y"; // show Step 2 (month review)

  // local pattern state (7 masks)
  const [pattern, setPattern] = React.useState<number[]>(() =>
    weeklyPattern?.length === 7 ? weeklyPattern : new Array(7).fill(0)
  );

  // month preview / editable array for role Y
  const [monthArr, setMonthArr] = React.useState<number[]>([]);

  // helper to build month days from a weekday mask
  const buildMonthFromPattern = React.useCallback(
    (mask: number[]) => {
      const daysInMonth = new Date(y, m, 0).getDate(); // m is 1-based
      return Array.from({ length: daysInMonth }, (_, i) => {
        const dow = new Date(y, m - 1, i + 1).getDay(); // 0..6
        return mask[dow] || 0;
      });
    },
    [y, m]
  );

  // When opening as reviewer (role Y), prebuild the month from the current pattern
  React.useEffect(() => {
    if (!open) return;
    if (isReviewEditor) {
      setMonthArr(buildMonthFromPattern(pattern));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isReviewEditor, y, m, pattern]);

  // Save logic:
  // - Role X: persist the weekly pattern and derive days on save
  // - Role Y: persist whatever the reviewer adjusted in monthArr (fallback to derived if empty)
  const handleSave = () => {
    // keep weekly pattern in store up to date (harmless for Y)
    if (pattern?.length === 7) {
      setWeeklyPattern(pattern);
    }

    const days = isWeeklyEditor
      ? buildMonthFromPattern(pattern)
      : monthArr?.length
        ? monthArr
        : buildMonthFromPattern(pattern);

    const payload = { year: y, month: m, days };
    saveMonth({ ...payload, createdAt: Date.now() });
    onSaved?.(payload);
  };

  // reset local state when closing
  React.useEffect(() => {
    if (!open) {
      setPattern(
        weeklyPattern?.length === 7 ? weeklyPattern : new Array(7).fill(0)
      );
      setMonthArr([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const monthLabel = React.useMemo(
    () =>
      new Date(y, m - 1, 1).toLocaleString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [y, m]
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      closeOnInteractOutside={false}
      closeOnEscape={false}
      scrollBehavior="outside"
      size="xl"
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          position="relative"
          display="flex"
          flexDir="column"
          maxH="100vh"
        >
          {/* Close */}
          <Dialog.CloseTrigger asChild>
            <StyledIconButton
              aria-label="Close dialog"
              variant="ghost"
              size="sm"
            >
              <X />
            </StyledIconButton>
          </Dialog.CloseTrigger>

          {/* Header */}
          <Dialog.Header
            pb={2}
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Heading size="md">
              {isWeeklyEditor
                ? `Set Weekly Pattern — ${monthLabel}`
                : `Review & Finalize — ${monthLabel}`}
            </Heading>
          </Dialog.Header>

          <Separator />

          {/* Body */}
          <Dialog.Body overflow="auto" pt={4} pb={2}>
            {isWeeklyEditor && (
              <Step1WeeklyTable pattern={pattern} setPattern={setPattern} />
            )}

            {isReviewEditor && (
              <MonthReview
                y={y}
                m={m}
                monthArr={monthArr}
                setMonthArr={setMonthArr}
                weekdayTemplate={pattern}
              />
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
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </HStack>

            <HStack>
              <Button onClick={handleSave}>Save</Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
