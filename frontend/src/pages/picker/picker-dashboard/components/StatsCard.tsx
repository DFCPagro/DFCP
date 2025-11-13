import {
  Card,
  HStack,
  Heading,
  VStack,
  Badge,
  Text,
  Icon,
} from "@chakra-ui/react";
import { Coins, Award } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PickerStats } from "../types";
import AccuracyProgress from "@/components/common/AccuracyProgress";
import { levelFromXP } from "../../../../../../backend/src/utils/level";
import { fetchPickerProfile, type PickerProfile } from "@/api/picker";
import { useNavigate } from "react-router-dom";
import { PATHS } from "@/routes/paths";

export default function StatsCard({ stats }: { stats: PickerStats }) {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<PickerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // fetch profile once
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

  // keyboard shortcut (G) → dashboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "g") navigate(PATHS.pickerDashboard);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  // derive level info from XP
  const { xpIntoLevel, reqThisLevel, level } = useMemo(() => {
    if (!profile) {
      return { xpIntoLevel: 0, reqThisLevel: 1, level: 0 };
    }
    return levelFromXP(profile.xp);
  }, [profile?.xp]);

  // percent of XP within current level (0–100)
  const progressToNextLevel = useMemo(() => {
    if (!reqThisLevel) return 0;
    return Math.min(100, Math.round((xpIntoLevel / reqThisLevel) * 100));
  }, [xpIntoLevel, reqThisLevel]);

  if (loading || !profile) {
    return (
      <Card.Root>
        <Card.Header>
          <HStack gap={2}>
            <Award size={18} />
            <Heading size="sm">My Stats</Heading>
          </HStack>
        </Card.Header>
        <Card.Body>
          <Text fontSize="sm">Loading…</Text>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root>
      <Card.Header>
        <HStack gap={2}>
          <Award size={18} />
          <Heading size="sm">My Stats</Heading>
        </HStack>
      </Card.Header>
      <Card.Body>
        <VStack align="stretch" gap={3}>
          <HStack>
            <Badge>Level {level}</Badge>
            <Badge gap={1} colorPalette="yellow">
              <Icon as={Coins} boxSize={3.5} />
              <Text fontSize="xs">{profile.mdCoins}</Text>
            </Badge>
          </HStack>

          <Text fontSize="sm">Orders today: {stats.ordersToday}</Text>
          <Text fontSize="sm">
            Avg pick: {stats.avgPickTimeMin} min/order
          </Text>

          <VStack align="stretch" gap={1}>
            <Text fontSize="xs" color="fg.muted">
              Next level progress
            </Text>
            <AccuracyProgress
              value={progressToNextLevel}
              thresholds={{ warn: 50, ok: 90 }}
              palettes={{ low: "purple", mid: "purple", high: "purple" }}
            />
            <Text fontSize="xs">{progressToNextLevel}%</Text>
          </VStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}
