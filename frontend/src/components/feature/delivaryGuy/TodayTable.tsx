import { useMemo } from 'react';
import { Card, HStack, Heading, Text, Table, Box } from '@chakra-ui/react';
import { SHIFTS } from '@/store/scheduleStore';
import { useEnsureMonth } from '@/store/selectors';

export default function TodayTable({ year, month }: { year: number; month: number }) {
  const ensureMonth = useEnsureMonth();
  const sch = useMemo(() => ensureMonth(year, month), [ensureMonth, year, month]);

  const today = new Date();
  const mask = sch.days[today.getDate() - 1] || 0;

  const rows = useMemo(
    () => SHIFTS.map((s, i) => ({ ...s, on: (mask & (1 << (3 - i))) !== 0 })),
    [mask]
  );

  return (
    <Card.Root>
      <Card.Header>
        <HStack justify="space-between" w="full">
          <Heading size="md">Today’s Shifts</Heading>
          <Text color="gray.600" fontSize="sm">
            {today.toLocaleDateString(undefined, {
              weekday: 'long', month: 'short', day: 'numeric',
            })}
          </Text>
        </HStack>
      </Card.Header>
      <Card.Body>
        <Table.Root size="sm" variant="line">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Shift</Table.ColumnHeader>
              <Table.ColumnHeader>Hours</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="center">Active</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((r) => (
              <Table.Row key={r.name}>
                <Table.Cell>{r.name}</Table.Cell>
                <Table.Cell>{r.start} - {r.end}</Table.Cell>
                <Table.Cell textAlign="center">{r.on ? '✅' : '—'}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>

        {!rows.some((r) => r.on) && (
          <Box mt={3} fontSize="sm" color="gray.600">
            Off day. Enjoy the break!
          </Box>
        )}
      </Card.Body>
    </Card.Root>
  );
}
