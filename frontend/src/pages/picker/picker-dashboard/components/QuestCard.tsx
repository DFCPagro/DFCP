import { Card, HStack, Heading, Text, Badge, Progress, Button } from "@chakra-ui/react";
import { Target, Clock } from "lucide-react";
import type { Quest } from "../types";

export default function QuestCard({ quest, timeLeftSec, onJoin }: { quest: Quest; timeLeftSec: number; onJoin: () => void }) {
  const mins = Math.floor(timeLeftSec / 60);
  const secs = timeLeftSec % 60;
  const pct = Math.round((quest.progress / quest.targetOrders) * 100);
  return (
    <Card.Root>
      <Card.Header>
        <HStack gap={2}>
          <Target size={18} />
          <Heading size="sm">{quest.title} ({quest.scope})</Heading>
        </HStack>
      </Card.Header>
      <Card.Body>
        <Text mb={2}>{quest.description}</Text>
        <HStack justify="space-between" mb={2}>
          <HStack gap={2}>
            <Badge colorPalette="green">Target: {quest.targetOrders}</Badge>
            <Badge colorPalette="purple">Reward: +{quest.rewardCoins} MD</Badge>
          </HStack>
          <HStack gap={2}>
            <Clock size={16} />
            <Text fontWeight="medium">
              {quest.active ? `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}` : "--:--"}
            </Text>
          </HStack>
        </HStack>
        <Progress.Root value={pct}><Progress.Track /><Progress.Range /></Progress.Root>
        <Text mt={1} fontSize="sm">{quest.progress} / {quest.targetOrders}</Text>
      </Card.Body>
      <Card.Footer>
        {!quest.active ? <Button onClick={onJoin}>Join</Button> : <Badge colorPalette="green">Active</Badge>}
      </Card.Footer>
    </Card.Root>
  );
}
