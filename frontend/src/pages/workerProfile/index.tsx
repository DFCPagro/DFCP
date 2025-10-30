// src/pages/workerProfile/index.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Grid,
  GridItem,
  Card,
  HStack,
  VStack,
  Heading,
  Text,
  Button,
  Progress,
  Badge,
  Avatar,
  Input,
  Switch,
  Separator,
  Kbd,
  SimpleGrid,
  IconButton,
  Icon,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { Play, Trophy, Coins, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { PATHS } from "@/routes/paths";
import { fetchPickerProfile, type PickerProfile } from "@/api/picker";

const ACCENT = "teal";
const PANEL_MAX_H = "calc(100vh - 180px)";
const xpPct = (xp: number) => Math.min(100, Math.round((xp % 1000) / 10));

// Prefer PATHS.pickerSchedule when available, fallback to hard-coded route
const SCHEDULE_PATH: string = (PATHS as any).pickerSchedule ?? "/picker/schedule";

export default function WorkerProfile() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<PickerProfile | null>(null);

  // prefs
  const [available, setAvailable] = useState(true);
  const [nickname, setNickname] = useState("");
  const [editingNick, setEditingNick] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await fetchPickerProfile();
      if (!alive) return;
      setProfile(p);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "g") navigate(PATHS.pickerDashboard);
      if (k === "o") navigate(PATHS.orders);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const accColor = useMemo<"red" | "yellow" | "teal">(() => {
    const a = profile?.metrics.accuracy ?? 0;
    if (a >= 98.5) return "teal";
    if (a >= 95) return "yellow";
    return "red";
  }, [profile]);

  if (loading || !profile) return <Box p={4}><Text>Loading…</Text></Box>;
  const xpProgress = xpPct(profile.xp);

  return (
    <Box p={4} maxW="1280px" mx="auto">
      {/* Master header */}
      <Card.Root
        overflow="hidden"
        rounded="xl"
        borderWidth="1px"
        bgGradient={`linear(to-r, ${ACCENT}.50, white)`}
        mb={5}
      >
        <Card.Body p={{ base: 4, md: 5 }}>
          <HStack justify="space-between" align="center" gap={4}>
            <HStack gap={4}>
              <Avatar.Root boxSize={{ base: 12, md: 16 }}>
                <Avatar.Fallback name={profile.name} />
              </Avatar.Root>
              <VStack align="start" gap={1}>
                <HStack gap={2} wrap="wrap">
                  <Heading size="md" color={`${ACCENT}.900`}>
                    {nickname || profile.name}
                  </Heading>
                  <Badge variant="solid" colorPalette="amber">{profile.level}</Badge>
                  <Badge variant="subtle" colorPalette="purple">
                    <HStack gap={1}>
                      <Icon as={Trophy} boxSize={3.5} />
                      <Text fontSize="xs">{profile.streakDays}d</Text>
                    </HStack>
                  </Badge>
                  <Badge variant="subtle" colorPalette="orange">
                    <HStack gap={1}>
                      <Icon as={Coins} boxSize={3.5} />
                      <Text fontSize="xs">{profile.coins}</Text>
                    </HStack>
                  </Badge>
                </HStack>
                <Text fontSize="sm" color="fg.muted">
                  {profile.site} • Shift {profile.shift.start}–{profile.shift.end}
                </Text>
                <HStack gap={2}>
                  <Kbd size="sm">G</Kbd>
                  <Text fontSize="xs" color="fg.muted">Start</Text>
                  <Kbd size="sm">O</Kbd>
                  <Text fontSize="xs" color="fg.muted">Orders</Text>
                </HStack>
              </VStack>
            </HStack>

            <HStack gap={2}>
              <Button size="sm" colorPalette={ACCENT} onClick={() => navigate(PATHS.pickerDashboard)}>
                <HStack gap={1.5}><Icon as={Play} boxSize={4} /><Text>Start</Text></HStack>
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate(PATHS.orders)}>
                Orders
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate(SCHEDULE_PATH)}>
                Schedule
              </Button>
          
            </HStack>
          </HStack>

          <Box mt={4}>
            <HStack justify="space-between" mb={1}>
              <Text fontSize="xs" color="fg.muted">Level progress</Text>
              <Text fontSize="xs" color="fg.muted">{profile.xp % 1000}/1000 XP</Text>
            </HStack>
            <Progress.Root value={xpProgress} h="2" rounded="md">
              <Progress.Track />
              <Progress.Range />
            </Progress.Root>
          </Box>
        </Card.Body>
      </Card.Root>

      {/* Body */}
      <Grid columns={{ base: 1, lg: 12 }} gap={5}>
        {/* Left column */}
        <GridItem colSpan={{ base: 12, lg: 7 }}>
          <Card.Root rounded="xl" borderWidth="1px">
            <Card.Header px={4} py={3}>
              <HStack justify="space-between" w="full">
                <Heading size="xs" textTransform="uppercase" letterSpacing="widest" color={`${ACCENT}.900`}>
                  Profile & Preferences
                </Heading>
                <Badge variant="outline">{profile.id}</Badge>
              </HStack>
            </Card.Header>
            <Card.Body p={4} maxH={PANEL_MAX_H} overflowY="auto">
              <VStack align="stretch" gap={4}>
                {/* Identity */}
                <HStack align="start" justify="space-between">
                  <VStack align="start" gap={1}>
                    <HStack>
                      <Text fontWeight="semibold">{nickname || profile.name}</Text>
                      <IconButton
                        aria-label="edit nickname"
                        size="xs"
                        variant="ghost"
                        onClick={() => setEditingNick((v) => !v)}
                      >
                        <Icon as={Pencil} boxSize={3.5} />
                      </IconButton>
                    </HStack>
                    <Text color="fg.muted" fontSize="sm">{profile.email}</Text>
                  </VStack>

                  <Card.Root borderWidth="1px" rounded="md" minW="210px">
                    <Card.Body p={3}>
                      <VStack align="stretch" gap={2}>
                        <HStack justify="space-between">
                          <Text fontSize="xs" color="fg.muted">Accuracy</Text>
                          <Badge size="sm" variant="subtle" colorPalette={accColor}>
                            {profile.metrics.accuracy.toFixed(1)}%
                          </Badge>
                        </HStack>
                        <Progress.Root value={profile.metrics.accuracy} max={100} h="2" rounded="sm">
                          <Progress.Track />
                          <Progress.Range />
                        </Progress.Root>
                      </VStack>
                    </Card.Body>
                  </Card.Root>
                </HStack>

                {editingNick && (
                  <HStack>
                    <Input
                      size="sm"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="Leaderboard name"
                    />
                    <Button size="sm" onClick={() => setEditingNick(false)}>Done</Button>
                  </HStack>
                )}

                <Separator />

                {/* Toggles */}
                <SimpleGrid columns={{ base: 1, sm: 3 }} gap={3}>
                  <ToggleCard
                    label="Available"
                    checked={available}
                    onChange={(v) => {
                      setAvailable(v);
                      toast.success(v ? "Available" : "Away");
                    }}
                  />
                </SimpleGrid>

                <HStack gap={2}>
                  <Button size="sm" colorPalette={ACCENT} onClick={() => navigate(PATHS.pickerDashboard)}>
                    <HStack gap={1.5}><Icon as={Play} boxSize={4} /><Text>Start picking</Text></HStack>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(PATHS.orders)}>My orders</Button>
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={async () => {
                      try {
                        setSaving(true);
                        toast.success("Saved");
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </HStack>
              </VStack>
            </Card.Body>
          </Card.Root>
        </GridItem>

        {/* Right column */}
        <GridItem colSpan={{ base: 12, lg: 5 }}>
          <Card.Root rounded="xl" borderWidth="1px">
            <Card.Header px={4} py={3}>
              <Heading size="xs" textTransform="uppercase" letterSpacing="widest" color={`${ACCENT}.900`}>
                Performance
              </Heading>
            </Card.Header>
            <Card.Body p={4} maxH={PANEL_MAX_H} overflowY="auto">
              <SimpleGrid columns={{ base: 2 }} gap={3}>
                <StatTile label="Orders" value={profile.metrics.orders} />
                <StatTile label="Lines" value={profile.metrics.lines} />
                <StatTile label="Speed" value={`${profile.metrics.speed} l/hr`} />
                <StatTile label="Streak" value={`${profile.streakDays} days`} />
              </SimpleGrid>
            </Card.Body>
          </Card.Root>
        </GridItem>

        {/* Progress: Daily quests / Achievements */}
        <GridItem colSpan={12}>
          <Card.Root rounded="xl" borderWidth="1px">
            <Card.Header px={4} py={3}>
              <Heading size="xs" textTransform="uppercase" letterSpacing="widest" color={`${ACCENT}.900`}>
                Progress
              </Heading>
            </Card.Header>
            <Card.Body p={4}>
              <Grid templateColumns="repeat(2, 1fr)" gap={4} alignItems="start">
                <GridItem colSpan={1} gap={1}>
                  {/* Daily quests */}
                  <Card.Root rounded="lg" borderWidth="1px" borderColor={`${ACCENT}.200`}>
                    <Card.Header py={2} px={3} bg="green.50" borderBottomWidth="1px">
                      <HStack justify="space-between">
                        <Heading size="xs" color={`${ACCENT}.900`}>Daily quests</Heading>
                        <Badge variant="subtle" colorPalette="green">Today</Badge>
                      </HStack>
                    </Card.Header>
                    <Card.Body p={3} maxH="420px" overflowY="auto">
                      <VStack align="stretch" gap={3}>
                        {profile.quests.map((q) => (
                          <Card.Root key={q.id} borderWidth="1px" rounded="md">
                            <Card.Body p={3}>
                              <VStack align="stretch" gap={2}>
                                <HStack justify="space-between">
                                  <Text fontWeight="semibold">{q.title}</Text>
                                  <Badge variant="solid" colorPalette="green">+{q.reward} XP</Badge>
                                </HStack>
                                <Text fontSize="sm" color="fg.muted">{q.goal}</Text>
                                <Progress.Root value={q.progress} h="2" rounded="sm">
                                  <Progress.Track />
                                  <Progress.Range />
                                </Progress.Root>
                              </VStack>
                            </Card.Body>
                          </Card.Root>
                        ))}
                      </VStack>
                    </Card.Body>
                  </Card.Root>
                </GridItem>

                <GridItem colSpan={0}>
                  {/* Achievements */}
                  <Card.Root rounded="lg" borderWidth="1px" borderColor="purple.200">
                    <Card.Header py={2} px={3} bg="purple.50" borderBottomWidth="1px">
                      <HStack justify="space-between">
                        <Heading size="xs" color={`${ACCENT}.900`}>Achievements</Heading>
                        <Badge variant="subtle" colorPalette="purple">{profile.achievements.length}</Badge>
                      </HStack>
                    </Card.Header>
                    <Card.Body p={3} maxH="420px" overflowY="auto">
                      <VStack align="stretch" gap={3}>
                        {profile.achievements.map((a) => (
                          <Card.Root key={a.id} borderWidth="1px" rounded="md">
                            <Card.Body p={3}>
                              <HStack align="start" gap={3}>
                                <Badge variant="subtle" colorPalette="purple" rounded="md">🏆</Badge>
                                <VStack align="start" gap={1}>
                                  <Text fontWeight="semibold">{a.name}</Text>
                                  <Text fontSize="sm" color="fg.muted">{a.desc}</Text>
                                </VStack>
                              </HStack>
                            </Card.Body>
                          </Card.Root>
                        ))}
                      </VStack>
                    </Card.Body>
                  </Card.Root>
                </GridItem>
              </Grid>
            </Card.Body>
          </Card.Root>
        </GridItem>
      </Grid>
    </Box>
  );
}

/* Helpers */

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <Card.Root borderWidth="1px" rounded="lg">
      <Card.Body p={3}>
        <VStack align="start" gap={0.5}>
          <Text fontSize="xs" color="fg.muted">{label}</Text>
          <Heading size="md" color={`${ACCENT}.900`}>{value}</Heading>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}

function ToggleCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Card.Root borderWidth="1px" rounded="md">
      <Card.Body p={3}>
        <HStack justify="space-between">
          <Text>{label}</Text>
          <Switch.Root size="sm" checked={checked} onCheckedChange={(e) => onChange(e.checked)}>
            <Switch.Control />
          </Switch.Root>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}
