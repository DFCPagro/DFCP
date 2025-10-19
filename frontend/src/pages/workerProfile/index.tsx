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
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { PATHS } from "@/routes/paths";
import { fetchPickerProfile, savePreferences, type PickerProfile } from "./data";

const ACCENT = "teal";
const PANEL_MAX_H = "calc(100vh - 180px)";
const xpPct = (xp: number) => Math.min(100, Math.round((xp % 1000) / 10));

export default function WorkerProfile() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<PickerProfile | null>(null);

  // prefs
  const [available, setAvailable] = useState(true);
  const [nickname, setNickname] = useState("");
  const [audio, setAudio] = useState(true);
  const [haptics, setHaptics] = useState(false);

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
      if (k === "s") navigate(PATHS.pickerDashboard);
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

  return (
    <Box p={4} maxW="1200px" mx="auto">
      {/* top bar */}
      <HStack
        justify="space-between"
        mb={3}
        bg={`${ACCENT}.50`}
        borderWidth="1px"
        borderColor={`${ACCENT}.200`}
        rounded="md"
        px={3}
        py={2}
      >
        <VStack align="start" gap={0}>
          <Heading size="sm" color={`${ACCENT}.900`}>Worker profile</Heading>
          <Text color="fg.muted" fontSize="xs">
            {profile.site} • Shift {profile.shift.start}–{profile.shift.end}
          </Text>
        </VStack>
      </HStack>

      {/* ===== Layout: two cards on top, one full-width bottom ===== */}
      <Grid columns={{ base: 1, lg: 12 }} gap={3}>
        {/* PROFILE (left) */}
        <GridItem colSpan={{ base: 12, lg: 7 }}>
          <Card.Root rounded="md" borderWidth="1px" borderColor="gray.200">
            <Card.Header py={2} px={3}>
              <Heading size="xs" textTransform="uppercase" letterSpacing="widest" color={`${ACCENT}.900`}>
                Profile
              </Heading>
            </Card.Header>
            <Card.Body p={3} maxH={PANEL_MAX_H} overflowY="auto">
              <HStack align="start" gap={3}>
                <Avatar.Root boxSize="10">
                  <Avatar.Fallback name={profile.name} />
                </Avatar.Root>
                <VStack align="start" gap={1} w="full">
                  <HStack justify="space-between" w="full">
                    <Heading size="sm">{nickname || profile.name}</Heading>
                    <Badge variant="solid" colorPalette="amber">{profile.level}</Badge>
                  </HStack>
                  <HStack gap={1} wrap="wrap">
                    <Badge size="sm" variant="solid" colorPalette={ACCENT}>Picker</Badge>
                    <Badge size="sm" variant="outline">{profile.id}</Badge>
                    <Badge size="sm" variant="subtle" colorPalette="amber">🪙 {profile.coins}</Badge>
                    <Badge size="sm" variant="subtle" colorPalette="purple">🔥 {profile.streakDays}d</Badge>
                  </HStack>
                  <Text color="fg.muted" fontSize="sm">{profile.email}</Text>

                  <VStack align="stretch" gap={1} mt={1}>
                    <Text fontSize="xs" color="fg.muted">Level progress</Text>
                    <Progress.Root value={xpPct(profile.xp)} h="1">
                      <Progress.Track />
                      <Progress.Range />
                    </Progress.Root>
                    <Text fontSize="xs" color="fg.muted">{profile.xp % 1000}/1000 XP</Text>
                  </VStack>

                  <HStack justify="space-between" w="full" mt={1}>
                    <Text>Availability</Text>
                    <Switch.Root
                      size="sm"
                      checked={available}
                      onCheckedChange={(e) => {
                        setAvailable(e.checked);
                        toast.success(e.checked ? "Available" : "Away");
                      }}
                    >
                      <Switch.Control />
                    </Switch.Root>
                  </HStack>

                  <HStack gap={1.5} mt={1}>
                    <Button size="xs" colorPalette={ACCENT} onClick={() => navigate(PATHS.pickerDashboard)}>
                      Start picking
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => navigate(PATHS.orders)}>
                      My orders
                    </Button>
                  </HStack>
                </VStack>
              </HStack>

              <Separator my={3} />

              {/* Preferences */}
              <Card.Root rounded="sm" borderWidth="1px" borderColor="gray.200">
                <Card.Header py={2} px={3}>
                  <Heading size="xs" color={`${ACCENT}.900`}>Preferences</Heading>
                </Card.Header>
                <Card.Body p={3}>
                  <VStack align="stretch" gap={2}>
                    <VStack align="stretch" gap={1}>
                      <Text fontSize="xs" color="fg.muted">Nickname</Text>
                      <Input
                        size="sm"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="Leaderboard name"
                      />
                    </VStack>
                    <HStack justify="space-between">
                      <Text>Audio cues</Text>
                      <Switch.Root size="sm" checked={audio} onCheckedChange={(e) => setAudio(e.checked)}>
                        <Switch.Control />
                      </Switch.Root>
                    </HStack>
                    <HStack justify="space-between">
                      <Text>Haptics</Text>
                      <Switch.Root size="sm" checked={haptics} onCheckedChange={(e) => setHaptics(e.checked)}>
                        <Switch.Control />
                      </Switch.Root>
                    </HStack>
                    <Button
                      size="xs"
                      disabled={saving}
                      alignSelf="flex-start"
                      onClick={async () => {
                        try {
                          setSaving(true);
                          await savePreferences({ nickname, audio, haptics, available });
                          toast.success("Saved");
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </VStack>
                </Card.Body>
              </Card.Root>
            </Card.Body>
          </Card.Root>
        </GridItem>

        {/* PERFORMANCE (right) */}
        <GridItem colSpan={{ base: 12, lg: 5 }}>
          <Card.Root rounded="md" borderWidth="1px" borderColor="gray.200">
            <Card.Header py={2} px={3}>
              <Heading size="xs" textTransform="uppercase" letterSpacing="widest" color={`${ACCENT}.900`}>
                Performance
              </Heading>
            </Card.Header>
            <Card.Body p={3} maxH={PANEL_MAX_H} overflowY="auto">
              <Grid columns={{ base: 2 }} gap={3}>
                <Card.Root rounded="sm" borderWidth="1px">
                  <Card.Body p={3}>
                    <VStack gap={0.5} align="start">
                      <Text fontSize="xs" color="fg.muted">Orders</Text>
                      <Heading size="md" color={`${ACCENT}.900`}>{profile.metrics.orders}</Heading>
                    </VStack>
                  </Card.Body>
                </Card.Root>
                <Card.Root rounded="sm" borderWidth="1px">
                  <Card.Body p={3}>
                    <VStack gap={0.5} align="start">
                      <Text fontSize="xs" color="fg.muted">Lines</Text>
                      <Heading size="md" color={`${ACCENT}.900`}>{profile.metrics.lines}</Heading>
                    </VStack>
                  </Card.Body>
                </Card.Root>
                <Card.Root rounded="sm" borderWidth="1px">
                  <Card.Body p={3}>
                    <VStack gap={1} align="stretch">
                      <Text fontSize="xs" color="fg.muted">Accuracy</Text>
                      <Badge size="sm" variant="subtle" alignSelf="flex-start" colorPalette={accColor}>
                        {profile.metrics.accuracy.toFixed(1)}%
                      </Badge>
                      <Progress.Root value={profile.metrics.accuracy} max={100} h="1">
                        <Progress.Track />
                        <Progress.Range />
                      </Progress.Root>
                    </VStack>
                  </Card.Body>
                </Card.Root>
                <Card.Root rounded="sm" borderWidth="1px">
                  <Card.Body p={3}>
                    <VStack gap={0.5} align="start">
                      <Text fontSize="xs" color="fg.muted">Speed</Text>
                      <Heading size="md" color={`${ACCENT}.900`}>{profile.metrics.speed}</Heading>
                      <Text fontSize="xs" color="fg.muted">lines/hr</Text>
                    </VStack>
                  </Card.Body>
                </Card.Root>
              </Grid>
            </Card.Body>
          </Card.Root>
        </GridItem>

     {/* PROGRESS (full width, no scroll) */}
{/* PROGRESS (two parts: Daily quests + Achievements) */}
<GridItem colSpan={12}>
  <Card.Root rounded="md" borderWidth="1px" borderColor="gray.200">
    <Card.Header py={2} px={3}>
      <Heading size="xs" textTransform="uppercase" letterSpacing="widest" color={`${ACCENT}.900`}>
        Progress
      </Heading>
    </Card.Header>

    <Card.Body p={3}>
      <Grid columns={{ base: 1, md: 2 }} gap={3} alignItems="start">
        {/* Daily quests */}
        <Card.Root rounded="md" borderWidth="1px" borderColor={`${ACCENT}.200`}>
          <Card.Header py={2} px={3} bg="green.50" borderBottomWidth="1px">
            <Heading size="xs" color={`${ACCENT}.900`}>Daily quests</Heading>
          </Card.Header>
          <Card.Body p={3}>
            <VStack align="stretch" gap={3}>
              {profile.quests.map((q) => (
                <Card.Root key={q.id} rounded="md" borderWidth="1px" borderColor="gray.200">
                  <Card.Body p={3}>
                    <VStack align="stretch" gap={1.5}>
                      <HStack justify="space-between" align="center">
                        <Text fontWeight="semibold" fontSize="md">{q.title}</Text>
                        <Badge variant="solid" colorPalette="green">+{q.reward} XP</Badge>
                      </HStack>
                      <Text fontSize="sm" color="fg.muted">{q.goal}</Text>
                      <Progress.Root value={q.progress} h="1">
                        <Progress.Track bg="gray.200" />
                        <Progress.Range bg="black" />
                      </Progress.Root>
                    </VStack>
                  </Card.Body>
                </Card.Root>
              ))}
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Achievements */}
        <Card.Root rounded="md" borderWidth="1px" borderColor={`${ACCENT}.200`}>
          <Card.Header py={2} px={3} bg="green.50" borderBottomWidth="1px">
            <Heading size="xs" color={`${ACCENT}.900`}>Achievements</Heading>
          </Card.Header>
          <Card.Body p={3}>
            <VStack align="stretch" gap={3}>
              {profile.achievements.map((a) => (
                <Card.Root key={a.id} rounded="md" borderWidth="1px" borderColor="gray.200">
                  <Card.Body p={3}>
                    <VStack align="start" gap={1}>
                      <Badge variant="subtle" colorPalette="purple" rounded="md">🏆</Badge>
                      <Text fontWeight="semibold" fontSize="md">{a.name}</Text>
                      <Box
                        as="span"
                        px="2"
                        py="1"
                        bg="gray.100"
                        borderRadius="sm"
                        borderWidth="1px"
                        color="fg.muted"
                        fontSize="sm"
                      >
                        {a.desc}
                      </Box>
                    </VStack>
                  </Card.Body>
                </Card.Root>
              ))}
            </VStack>
          </Card.Body>
        </Card.Root>
      </Grid>
    </Card.Body>
  </Card.Root>
</GridItem>

      </Grid>
    </Box>
  );
}
