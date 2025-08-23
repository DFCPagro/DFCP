import { Box, VStack, Text, Steps, Heading } from "@chakra-ui/react";
import { monthName } from "@/store/scheduleStore";
import { ACTIVE_COLOR } from "./constants";

export default function StepsHeader({
  stepIdx,
  setStepIdx,
  y,
  m,
}: {
  stepIdx: number;
  setStepIdx: (n: number) => void;
  y: number;
  m: number;
}) {
  return (
    <VStack align="stretch" gap={2}>
      {/* Use a regular heading instead of Steps.Title here */}
      <Box>
        <Heading size="md">Plan Next Month</Heading>
        <Text color="gray.600" mt={1} fontSize="sm">
          {monthName(m)} {y} • Tri-state chips (Off → On → Standby), max 2 picks per weekday/day
        </Text>
      </Box>

      {/* All Steps.* stay under Steps.Root */}
      <Steps.Root
        step={stepIdx}
        onStepChange={(d) => setStepIdx(d.step)}
        linear
        size="sm"
        variant="subtle"
        colorPalette={ACTIVE_COLOR}
      >
        <Steps.List>
          <Steps.Item index={0}>
            <Steps.Trigger>
              <Steps.Indicator />
              <Steps.Title>Weekly pattern</Steps.Title>
              <Steps.Description>Set template per weekday</Steps.Description>
            </Steps.Trigger>
            <Steps.Separator />
          </Steps.Item>

          <Steps.Item index={1}>
            <Steps.Trigger>
              <Steps.Indicator />
              <Steps.Title>Review & edit</Steps.Title>
              <Steps.Description>Apply & fine-tune month</Steps.Description>
            </Steps.Trigger>
          </Steps.Item>
        </Steps.List>
      </Steps.Root>
    </VStack>
  );
}
