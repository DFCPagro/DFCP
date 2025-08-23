import { VStack, Box, Heading, Text, Steps } from "@chakra-ui/react";
import { monthName } from "@/store/scheduleStore";
import { ACTIVE_COLOR } from "../constants";

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
    <VStack align="stretch" gap={{ base: 2, md: 3 }}>
      {/* Title + subtitle */}
      <Box>
        <Heading size={{ base: "sm", md: "md" }}>Plan Next Month</Heading>

        {/* On phones: only show "Month Year". On md+: show full guidance */}
        <Text
          color="gray.600"
          mt={1}
          fontSize={{ base: "xs", md: "sm" }}
          lineClamp={{ base: 1, md: 2 }}
        >
          <Box as="span" display={{ base: "inline", md: "none" }}>
            {monthName(m)} {y}
          </Box>
          <Box as="span" display={{ base: "none", md: "inline" }}>
            {monthName(m)} {y} • Tri-state chips (Off → On → Standby), max 2 picks per weekday/day
          </Box>
        </Text>
      </Box>

      {/* Steps */}
      <Steps.Root
        step={stepIdx}
        onStepChange={(d) => setStepIdx(d.step)}
        linear
        size={{ base: "xs", md: "sm" }}     // smaller on phones
        variant="subtle"
        colorPalette={ACTIVE_COLOR}
      >
        <Steps.List>
          <Steps.Item index={0}>
            <Steps.Trigger>
              <Steps.Indicator />
              {/* Short title on phone, full on desktop */}
              <Steps.Title display={{ base: "block", md: "none" }}>
                Pattern
              </Steps.Title>
              <Steps.Title display={{ base: "none", md: "block" }}>
                Weekly pattern
              </Steps.Title>

              {/* Hide descriptions on phones */}
              <Steps.Description display={{ base: "none", md: "block" }}>
                Set template per weekday
              </Steps.Description>
            </Steps.Trigger>
            <Steps.Separator />
          </Steps.Item>

          <Steps.Item index={1}>
            <Steps.Trigger>
              <Steps.Indicator />
              <Steps.Title display={{ base: "block", md: "none" }}>
                Review
              </Steps.Title>
              <Steps.Title display={{ base: "none", md: "block" }}>
                Review & edit
              </Steps.Title>

              <Steps.Description display={{ base: "none", md: "block" }}>
                Apply & fine-tune month
              </Steps.Description>
            </Steps.Trigger>
          </Steps.Item>
        </Steps.List>
      </Steps.Root>
    </VStack>
  );
}
