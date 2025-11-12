import { Card, HStack, Heading, VStack, Badge, Text, Progress, Icon, } from "@chakra-ui/react";
import { Coins } from "lucide-react";

import { Award } from "lucide-react";
import type { PickerStats } from "../types";
import AccuracyProgress from "@/components/common/AccuracyProgress"

export default function StatsCard({ stats }: { stats: PickerStats }) {
  const pctToNext = Math.min(100, Math.round(((stats.coins % 100) / 100) * 100));
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
            <Badge>Level {stats.level}</Badge>
            <Badge gap={1} colorPalette="yellow">
              <Icon as={Coins} boxSize={3.5} />
              <Text fontSize="xs">{stats.coins}</Text>
            </Badge>
          </HStack>
          <Text fontSize="sm">Orders today: {stats.ordersToday}</Text>
          <Text fontSize="sm">Avg pick: {stats.avgPickTimeMin} min/order</Text>
          <Text fontSize="sm">Streak: {stats.streakDays} days</Text>

          <VStack align="stretch" gap={1}>
            <Text fontSize="xs" color="fg.muted">Next level progress</Text>
            <AccuracyProgress
              value={pctToNext}
              thresholds={{ warn: 50, ok: 90 }}
              palettes={{ low: "purple", mid: "purple", high: "purple" }}
            />
            {/* <Progress.Root value={pctToNext}>
              <Progress.Track />
              <Progress.Range />
            </Progress.Root> */}
            <Text fontSize="xs">{pctToNext}%</Text>
          </VStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}
