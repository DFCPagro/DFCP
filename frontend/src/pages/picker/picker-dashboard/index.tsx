// src/pages/picker/picker-dashboard/index.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Container,
  Grid,
  GridItem,
  HStack,
  Text,
  Button,
  Spinner,
  Card,
  Badge,
  Separator,
  Box,
} from "@chakra-ui/react";
import { RefreshCcw, Play } from "lucide-react";
import toast from "react-hot-toast";
import type { LeaderboardEntry, PickerStats, Quest, QuestScope, ReadyOrder } from "./types";
import {
  apiFetchLeaderboard,
  apiFetchQuests,
  apiFetchReadyOrders,
  apiFetchStats,
  apiClaimOrder,
} from "./api/mock";
import { useInterval } from "./hooks/useInterval";
import { LeaderboardCard, QuestCard, ReadyOrdersTable, StatsCard } from "./components";
import { useNavigate } from "react-router-dom";
import { PATHS } from "@/routes/paths";

/* Glow frame without animations */
function GlowCard({
  children,
  from,
  to,
}: {
  children: React.ReactNode;
  from: string;
  to: string;
}) {
  return (
    <Box p="1px" rounded="2xl" bgGradient={`linear(to-r, ${from}, ${to})`} shadow="md">
      <Card.Root
        rounded="2xl"
        overflow="hidden"
        borderWidth="1px"
        borderColor="blackAlpha.100"
        _dark={{ bg: "gray.900", borderColor: "whiteAlpha.100" }}
      >
        {children}
      </Card.Root>
    </Box>
  );
}



export default function PickerDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PickerStats | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [orders, setOrders] = useState<ReadyOrder[]>([]);
  const [scope, setScope] = useState<QuestScope>("day");
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();

  const [showOrders, setShowOrders] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [s, b, q] = await Promise.all([apiFetchStats(), apiFetchLeaderboard(), apiFetchQuests()]);
      if (!alive) return;
      setStats(s);
      setBoard(b);
      setQuests(q);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  useInterval(() => {
    setQuests((prev) =>
      prev.map((q) => {
        if (!q.active || !q.expiresAt) return q;
        if (Date.now() >= q.expiresAt)
          return { ...q, active: false, startedAt: undefined, expiresAt: undefined, progress: 0 };
        return q;
      }),
    );
  }, 1000);

  const activeQuest = useMemo(() => quests.find((q) => q.scope === scope), [quests, scope]);

  const handleJoinQuest = () => {
    if (!activeQuest) return;
    setQuests((prev) =>
      prev.map((q) =>
        q.id === activeQuest.id
          ? { ...q, active: true, progress: 0, startedAt: Date.now(), expiresAt: Date.now() + q.timeLimitMin * 60 * 1000 }
          : q,
      ),
    );
    toast.success("Quest started");
  };

  const timeLeftSec = useMemo(() => {
    const q = activeQuest;
    if (!q?.active || !q.expiresAt) return 0;
    return Math.max(0, Math.floor((q.expiresAt - Date.now()) / 1000));
  }, [activeQuest]);

  const onClaimOrder = async (id: string) => {
    await apiClaimOrder(id);
    const order = orders.find((o) => o.id === id);
    const taskParam = String(order?.orderId ?? id).replace(/^#/, "");
    setOrders((list) => list.filter((o) => o.id !== id));
    toast.success("Order claimed");
    navigate(PATHS.pickerTask.replace(":taskId", encodeURIComponent(taskParam)));
  };

  const onRefresh = () => setRefreshKey((k) => k + 1);

  const onStartPicking = async () => {
    setShowOrders(true);
    setOrdersLoading(true);
    const data = await apiFetchReadyOrders();
    setOrders(data);
    setOrdersLoading(false);
    toast("Orders unlocked", { icon: "🔓" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !showOrders && !loading) {
        e.preventDefault();
        onStartPicking();
      }
      if (e.code === "KeyR") onRefresh();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showOrders, loading]);

  if (loading || !stats || !activeQuest) {
    return (
      <Container maxW="7xl" py={6}>
        <HStack gap={3}>
          <Spinner />
          <Text>Loading dashboard…</Text>
        </HStack>
      </Container>
    );
  }

  return (
    <Container maxW="7xl" py={6}>
      {/* Control bar */}
      <HStack
        justify="flex-end"
        mb={5}
        bg="bg.muted"
        _dark={{ bg: "gray.800" }}
        borderWidth="1px"
        rounded="full"
        px={2}
        py={2}
        gap={2}
        shadow="sm"
      >
        <HStack bg="bg.subtle" _dark={{ bg: "blackAlpha.300" }} rounded="full" p="1" borderWidth="1px">
          <Button
            size="sm"
            variant={scope === "day" ? "solid" : "ghost"}
            colorPalette="purple"
            onClick={() => setScope("day")}
            rounded="full"
          >
            Daily
          </Button>
          <Button
            size="sm"
            variant={scope === "week" ? "solid" : "ghost"}
            colorPalette="purple"
            onClick={() => setScope("week")}
            rounded="full"
          >
            Weekly
          </Button>
        </HStack>

        <Button size="sm" variant="outline" onClick={onRefresh}>
          <HStack gap={2}>
            <RefreshCcw size={16} />
            <span>Refresh</span>
          </HStack>
        </Button>
      </HStack>

      <Grid columns={{ base: 1, md: 12 }} gap={5}>
        {/* Stats */}
        <GridItem colSpan={{ base: 12, md: 4 }}>
          <GlowCard from="purple.500" to="pink.400">
            <Card.Body
              bgGradient="linear(to-b, purple.50, white)"
              _dark={{ bgGradient: "linear(to-b, gray.900, gray.800)" }}
            >
              <StatsCard stats={stats} />
            </Card.Body>
          </GlowCard>
        </GridItem>

        {/* Quest */}
        <GridItem colSpan={{ base: 12, md: 5 }}>
          <GlowCard from="pink.400" to="orange.400">
            <Card.Body
              bgGradient="linear(to-b, pink.50, white)"
              _dark={{ bgGradient: "linear(to-b, gray.900, gray.800)" }}
            >
              <QuestCard quest={activeQuest} timeLeftSec={timeLeftSec} onJoin={handleJoinQuest} />
            </Card.Body>
          </GlowCard>
        </GridItem>

        {/* Leaderboard */}
        <GridItem colSpan={{ base: 12, md: 3 }}>
          <GlowCard from="cyan.400" to="purple.500">
            <Card.Body>
              <HStack justify="space-between" mb={2}>
                <Text fontWeight="semibold">Leaderboard</Text>
                <Badge variant="subtle" colorPalette="purple">Live</Badge>
              </HStack>
              <LeaderboardCard board={board} myId="me" />
            </Card.Body>
          </GlowCard>
        </GridItem>

        {/* Orders */}
        <GridItem colSpan={12}>
          {!showOrders ? (
            <GlowCard from="green.400" to="teal.400">
              <Card.Body
                bgGradient="linear(to-r, green.50, white)"
                _dark={{ bgGradient: "linear(to-r, gray.900, gray.800)" }}
              >
                <HStack justify="space-between" wrap="wrap" w="full">
                  <HStack gap={3}>
                    <Text fontSize="lg" fontWeight="semibold">
                      Ready when you are
                    </Text>
                    <Text color="fg.muted">Orders stay hidden until you start.</Text>
                  </HStack>
                  <Button
                    onClick={onStartPicking}
                    size="lg"
                    colorPalette="green"
                    rounded="full"
                    transition="transform .12s ease"
                    _hover={{ transform: "translateY(-1px)" }}
                  >
                    <HStack gap={2}>
                      <Play size={18} />
                      <Text>Start picking</Text>
                    </HStack>
                  </Button>
                </HStack>
                <Separator my={3} />
                <Box>
                  <Text fontSize="sm" color="fg.muted">
                    Tip: batch similar items to move faster.
                  </Text>
                </Box>
              </Card.Body>
            </GlowCard>
          ) : ordersLoading ? (
            <HStack gap={3}>
              <Spinner />
              <Text>Loading orders…</Text>
            </HStack>
          ) : (
            <ReadyOrdersTable orders={orders} onClaim={onClaimOrder} />
          )}
        </GridItem>
      </Grid>
    </Container>
  );
}
