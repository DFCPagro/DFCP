import { useCallback, useState } from 'react';
import {
  Heading, HStack, Button, VStack, Card, IconButton, Separator, SimpleGrid,
} from '@chakra-ui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

import { monthName } from '@/store/scheduleStore';
import PlanNextMonthDialog from '@/components/feature/delivaryGuy/PlanNextMonthDialog';

import { useDisclosure } from '@chakra-ui/react';
import { useToday } from '@/hooks/useToday';
import { getNextMonth, getPrevMonth, fmtTodayChip } from '@/utils/date';
import { toastSaved, toastCanceled } from '@/utils/toast';

import TodayTable from '@/components/feature/delivaryGuy/TodayTable';
import UpcomingTable from '@/components/feature/delivaryGuy/UpcomingTable';
import MonthGrid from '@/components/feature/delivaryGuy/MonthGrid';

export default function DriverSchedule() {
  const { open, onOpen, onClose } = useDisclosure();
  const today = useToday();

  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() + 1 });

  const gotoPrev = useCallback(() => setView(v => getPrevMonth(v.y, v.m)), []);
  const gotoNext = useCallback(() => setView(v => getNextMonth(v.y, v.m)), []);
  const gotoToday = useCallback(() => {
    const d = new Date();
    setView({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }, []);

  return (
    <VStack align="stretch" gap={6}>
      {/* Header */}
      <Card.Root>
        <Card.Body>
          <HStack justify="space-between" wrap="wrap" gap={3} w="full">
            <HStack gap={2} align="center">
              <Heading>Schedule</Heading>
              <Separator orientation="vertical" />
              <HStack gap={1}>
                <Tooltip content="Previous month (←)">
                  <IconButton aria-label="Previous month" size="sm" onClick={gotoPrev}>
                    <ChevronLeft />
                  </IconButton>
                </Tooltip>

                <Tooltip content={`Go to current month • ${fmtTodayChip(today)}`}>
                  <Button size="sm" variant="outline" onClick={gotoToday}>
                    {monthName(view.m)} {view.y}
                  </Button>
                </Tooltip>

                <Tooltip content="Next month (→)">
                  <IconButton aria-label="Next month" size="sm" onClick={gotoNext}>
                    <ChevronRight />
                  </IconButton>
                </Tooltip>
              </HStack>
            </HStack>
            <HStack>
              <Button colorPalette="blue" onClick={onOpen}>Plan Next Month</Button>
            </HStack>
          </HStack>
        </Card.Body>
      </Card.Root>

      {/* Content */}
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
        <TodayTable year={today.getFullYear()} month={today.getMonth() + 1} />
        <UpcomingTable />
      </SimpleGrid>

      <MonthGrid year={view.y} month={view.m} />

      {/* Modal */}
      <PlanNextMonthDialog
        open={open}
        onClose={() => {
          onClose();
          toastCanceled();
        }}
        onSaved={(payload) => {
          onClose();
          toastSaved(payload.year, payload.month, payload.days.length);
        }}
      />
    </VStack>
  );
}
