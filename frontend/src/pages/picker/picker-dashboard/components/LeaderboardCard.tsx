import { Card, HStack, Heading, Table, Text, Badge } from "@chakra-ui/react";
import { Trophy, Users2 } from "lucide-react";
import type { LeaderboardEntry } from "../types";

export default function LeaderboardCard({ board, myId }: { board: LeaderboardEntry[]; myId: string }) {
  return (
    <Card.Root>
      <Card.Header>
        <HStack gap={2}>
          <Trophy size={18} />
          <Heading size="sm">Leaderboard</Heading>
        </HStack>
      </Card.Header>
      <Card.Body>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>#</Table.ColumnHeader>
              <Table.ColumnHeader>Picker</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Orders</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">MD</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {board.slice(0, 10).map((e) => (
              <Table.Row key={e.id} style={e.id === myId ? { background: "var(--chakra-colors-bg-muted)" } : undefined}>
                <Table.Cell>{e.rank}</Table.Cell>
                <Table.Cell>
                  <HStack gap={2}>
                    <Users2 size={14} />
                    <Text>{e.name}</Text>
                    {e.id === myId && <Badge colorPalette="teal">You</Badge>}
                  </HStack>
                </Table.Cell>
                <Table.Cell textAlign="end">{e.orders}</Table.Cell>
                <Table.Cell textAlign="end">{e.coins}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Card.Body>
    </Card.Root>
  );
}
