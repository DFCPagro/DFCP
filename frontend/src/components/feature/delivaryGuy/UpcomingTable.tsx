import { useMemo } from 'react';
import { Card, Heading, Table } from '@chakra-ui/react';
import { daysLong, shiftNamesFromMask } from '@/store/scheduleStore';
import { useEnsureMonth } from '@/store/selectors';

export default function UpcomingTable() {
  const ensureMonth = useEnsureMonth();

  const rows = useMemo(() => {
    const out: { dateLabel: string; dow: string; names: string[]; key: string }[] = [];
    const today = new Date();
    for (let offset = 1; offset <= 5; offset++) {
      const dt = new Date(today);
      dt.setDate(today.getDate() + offset);
      const y = dt.getFullYear();
      const m = dt.getMonth() + 1;
      const month = ensureMonth(y, m);
      const mask = month.days[dt.getDate() - 1] || 0;
      out.push({
        dateLabel: dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }),
        dow: daysLong[dt.getDay()],
        names: shiftNamesFromMask(mask),
        key: `${y}-${m}-${dt.getDate()}`,
      });
    }
    return out;
  }, [ensureMonth]);

  return (
    <Card.Root>
      <Card.Header>
        <Heading size="md">Upcoming (Next 5 Days)</Heading>
      </Card.Header>
      <Card.Body>
        <Table.Root size="sm" variant="line">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Date</Table.ColumnHeader>
              <Table.ColumnHeader>Day</Table.ColumnHeader>
              <Table.ColumnHeader>Active Shifts</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
        <Table.Body>
          {rows.map((r) => (
            <Table.Row key={r.key}>
              <Table.Cell>{r.dateLabel}</Table.Cell>
              <Table.Cell>{r.dow}</Table.Cell>
              <Table.Cell>{r.names.length ? r.names.join(', ') : '—'}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
        </Table.Root>
      </Card.Body>
    </Card.Root>
  );
}
