import { Card, HStack, Heading, Text, Grid, GridItem, Badge, Box } from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
import { SHIFTS, monthName } from '@/store/scheduleStore';
import { useEnsureMonth } from '@/store/selectors';
import { useMemo } from 'react';

export default function MonthGrid({ year, month }: { year: number; month: number }) {
  const ensureMonth = useEnsureMonth();
  const sch = useMemo(() => ensureMonth(year, month), [ensureMonth, year, month]);

  const firstDow = new Date(year, month - 1, 1).getDay();
  const total = sch.days.length;

  return (
    <Card.Root>
      <Card.Header>
        <HStack justify="space-between" wrap="wrap" w="full">
          <HStack>
            <Badge colorPalette="green">Active</Badge>
            <Badge>Off</Badge>
            <Text color="gray.600" fontSize="sm">Shifts: Morning • Afternoon • Evening • Night</Text>
          </HStack>
          <Heading size="md">{monthName(month)} {year}</Heading>
        </HStack>
      </Card.Header>
      <Card.Body>
        <Grid templateColumns="repeat(7, 1fr)" gap={2}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((h) => (
            <GridItem key={h} rounded="md" p={2} textAlign="center">
              <Badge w="full" variant="outline" justifyContent="center" p={2}>{h}</Badge>
            </GridItem>
          ))}

          {Array.from({ length: firstDow }, (_, i) => (
            <GridItem key={`b${i}`} rounded="md" p={2} border="1px" borderColor="gray.100" />
          ))}

          {Array.from({ length: total }, (_, i) => {
            const mask = sch.days[i] || 0;
            return (
              <GridItem key={i} border="1px" borderColor="gray.200" rounded="md" p={2}>
                <Box textAlign="right" fontSize="sm" color="gray.600">{i + 1}</Box>
                <HStack gap={1} wrap="wrap" mt={2}>
                  {SHIFTS.map((s, si) => {
                    const bit = 1 << (3 - si);
                    const on = (mask & bit) !== 0;
                    return (
                      <Tooltip key={s.name} content={`${s.name}: ${s.start} - ${s.end}`}>
                        <Badge variant={on ? 'solid' : 'outline'} colorPalette={on ? 'green' : 'gray'}>
                          {s.name[0]}
                        </Badge>
                      </Tooltip>
                    );
                  })}
                </HStack>
              </GridItem>
            );
          })}
        </Grid>
      </Card.Body>
    </Card.Root>
  );
}
