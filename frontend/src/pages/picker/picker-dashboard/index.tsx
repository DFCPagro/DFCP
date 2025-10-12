// src/pages/picker/picker-dashboard/index.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Container, Grid, GridItem, HStack, Heading, Text, Button, Spinner, Card,
} from "@chakra-ui/react";
import { RefreshCcw } from "lucide-react";
import type { LeaderboardEntry, PickerStats, Quest, QuestScope, ReadyOrder } from "./types";
import {
  apiFetchLeaderboard, apiFetchQuests, apiFetchReadyOrders, apiFetchStats, apiClaimOrder,
} from "./api/mock";
import { useInterval } from "./hooks/useInterval";
import { LeaderboardCard, QuestCard, ReadyOrdersTable, StatsCard } from "./components";

export default function PickerDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PickerStats | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [orders, setOrders] = useState<ReadyOrder[]>([]);
  const [scope, setScope] = useState<QuestScope>("day");
  const [refreshKey, setRefreshKey] = useState(0);

  // gate for the orders table
  const [showOrders, setShowOrders] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [s, b, q] = await Promise.all([
        apiFetchStats(),
        apiFetchLeaderboard(),
        apiFetchQuests(),
      ]);
      if (!alive) return;
      setStats(s);
      setBoard(b);
      setQuests(q);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [refreshKey]);

  useInterval(() => {
    setQuests(prev =>
      prev.map(q => {
        if (!q.active || !q.expiresAt) return q;
        if (Date.now() >= q.expiresAt)
          return { ...q, active: false, startedAt: undefined, expiresAt: undefined, progress: 0 };
        return q;
      }),
    );
  }, 1000);

  const activeQuest = useMemo(() => quests.find(q => q.scope === scope), [quests, scope]);

  const handleJoinQuest = () => {
    if (!activeQuest) return;
    setQuests(prev =>
      prev.map(q =>
        q.id === activeQuest.id
          ? {
              ...q,
              active: true,
              progress: 0,
              startedAt: Date.now(),
              expiresAt: Date.now() + q.timeLimitMin * 60 * 1000,
            }
          : q,
      ),
    );
  };

  const timeLeftSec = useMemo(() => {
    const q = activeQuest;
    if (!q?.active || !q.expiresAt) return 0;
    return Math.max(0, Math.floor((q.expiresAt - Date.now()) / 1000));
  }, [activeQuest]);

  const onClaimOrder = async (id: string) => {
    await apiClaimOrder(id);
    setOrders(list => list.filter(o => o.id !== id));
  };

  const onRefresh = () => setRefreshKey(k => k + 1);

  const onStartPicking = async () => {
    setShowOrders(true);
    setOrdersLoading(true);
    const data = await apiFetchReadyOrders();
    setOrders(data);
    setOrdersLoading(false);
  };

  if (loading || !stats || !activeQuest) {
    return (
      <Container maxW="7xl" py={6}>
        <HStack gap={3}><Spinner /><Text>Loading dashboard…</Text></HStack>
      </Container>
    );
  }

  return (
    <Container maxW="7xl" py={6}>
      <HStack justify="space-between" mb={4}>
        <Heading size="lg">Picker Dashboard</Heading>
        <HStack gap={2}>
          <Button variant={scope === "day" ? "solid" : "outline"} onClick={() => setScope("day")}>Daily</Button>
          <Button variant={scope === "week" ? "solid" : "outline"} onClick={() => setScope("week")}>Weekly</Button>
          <Button variant="outline" onClick={onRefresh}>
            <HStack gap={2}><RefreshCcw size={16} /><span>Refresh</span></HStack>
          </Button>
        </HStack>
      </HStack>

      <Grid columns={{ base: 1, md: 12 }} gap={4}>
        <GridItem colSpan={{ base: 12, md: 4 }}>
          <StatsCard stats={stats} />
        </GridItem>

        <GridItem colSpan={{ base: 12, md: 5 }}>
          <QuestCard quest={activeQuest} timeLeftSec={timeLeftSec} onJoin={handleJoinQuest} />
        </GridItem>

        <GridItem colSpan={{ base: 12, md: 3 }}>
          <LeaderboardCard board={board} myId="me" />
        </GridItem>

        <GridItem colSpan={12}>
          {!showOrders ? (
            <Card.Root>
              <Card.Body>
                <HStack justify="space-between" wrap="wrap">
                  <Text>Ready-to-pick orders are hidden. Start when you’re ready.</Text>
                  <Button onClick={onStartPicking}>Start picking</Button>
                </HStack>
              </Card.Body>
            </Card.Root>
          ) : ordersLoading ? (
            <HStack gap={3}><Spinner /><Text>Loading orders…</Text></HStack>
          ) : (
            <ReadyOrdersTable orders={orders} onClaim={onClaimOrder} />
          )}
        </GridItem>
      </Grid>
    </Container>
  );
}
