// src/pages/Home.tsx
import { useMemo } from "react";
import {
  Container,
  Heading,
  Text,
  Box,
  Button,
  Separator,
  Card,
  Stack,
  Badge,
  HStack,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { TIME_FRAMES, describeArrival, todayIL } from "@/store/timeframes";
import { Sun, Sunset, Moon, Info } from "lucide-react";

const iconFor = (key: string) =>
  key === "morning" ? Sun :
  key === "afternoon" ? Sunset :
  Moon;

const frameColor = (key: string) =>
  key === "morning" ? "teal" :
  key === "afternoon" ? "amber" :
  "purple";

export default function Home() {
  const dateIL = useMemo(() => todayIL(), []);
  const frames = useMemo(
    () =>
      TIME_FRAMES.map((tf) => {
        const arrival = describeArrival(tf);
        const day = arrival.toLowerCase().includes("today") ? "today" : "tomorrow";
        return {
          key: tf.key,
          label: tf.label,
          window: tf.windowLabel,
          arrival,
          day,
        };
      }),
    []
  );

  return (
    <Box
      bgGradient={{
        base: "linear(to-b, gray.50, white)",
        _dark: "linear(to-b, gray.900, gray.950)",
      }}
    >
      {/* Hero */}
      <Box
        py={{ base: 10, md: 14 }}
        borderBottomWidth="1px"
        bgGradient={{
          base: "linear(to-r, teal.50, purple.50)",
          _dark: "linear(to-r, teal.900, purple.900)",
        }}
      >
        <Container maxW="6xl">
          <Heading size="2xl" letterSpacing="tight" mb={3}>
            DFCP
          </Heading>
          <Text fontSize="lg" color="fg.muted" maxW="3xl">
            Fresh produce with transparent quality and on-time delivery windows.
            Real stock. Clear grades. Reliable logistics.
          </Text>

          <HStack mt={6} gap={3} wrap="wrap">
            <Button asChild size="md" colorPalette="teal">
              <RouterLink to="/market">Start shopping</RouterLink>
            </Button>
            <Button asChild size="md" variant="outline" colorPalette="purple">
              <RouterLink to="/about">Learn more</RouterLink>
            </Button>
            <Badge colorPalette="gray" variant="surface" px={2}>
              Israel time • {dateIL}
            </Badge>
          </HStack>
        </Container>
      </Box>

      <Container maxW="6xl" py={10}>
        {/* Time frames */}
        <Card.Root mb={10} overflow="hidden">
          <Box
            h="6px"
            bgGradient={{
              base: "linear(to-r, teal.400, amber.400, purple.400)",
              _dark: "linear(to-r, teal.300, amber.300, purple.300)",
            }}
          />
          <Card.Header>
            <HStack justify="space-between" align="center" w="full">
              <HStack>
                <Info size={18} />
                <Card.Title>How delivery time frames work</Card.Title>
              </HStack>
              <Badge variant="solid" colorPalette="teal">Live calculation</Badge>
            </HStack>
            <Card.Description>Choose a window. We deliver within it.</Card.Description>
          </Card.Header>

          <Card.Body>
            <Stack gap={4}>
              {frames.map((f) => {
                const Icon = iconFor(f.key);
                const cp = frameColor(f.key);
                return (
                  <HStack
                    key={f.key}
                    p={4}
                    rounded="xl"
                    borderWidth="1px"
                    bg={{ base: "bg.panel", _dark: "gray.800" }}
                    _hover={{ shadow: "md", translateY: "-1px" }}
                    transition="all 120ms ease-out"
                    justify="space-between"
                    align="center"
                  >
                    <HStack gap={4}>
                      <Box
                        p={2}
                        rounded="full"
                        borderWidth="1px"
                        bg={`colorPalette.${cp}.solid`}
                        color="white"
                      >
                        <Icon size={18} />
                      </Box>
                      <Box>
                        <Heading size="sm">{f.label}</Heading>
                        <Text fontSize="sm" color="fg.muted">
                          {f.window}
                        </Text>
                      </Box>
                    </HStack>

                    {/* Removed per-frame shop button; keep arrival badge only */}
                    <Badge variant="subtle" colorPalette={cp}>
                      {f.arrival.replace(`${f.label} (${f.window}): `, "")}
                    </Badge>
                  </HStack>
                );
              })}
            </Stack>

            <Separator my={8} />

            <Stack gap={3}>
              <Heading size="sm">Simple flow</Heading>
              <Text color="fg.muted">
                1) Pick a time frame. 2) Market shows only stock for that frame. 3) Add items. 4) Checkout. 5) We deliver within the selected window.
              </Text>
            </Stack>

            <Separator my={8} />

            <Stack gap={3}>
              <Heading size="sm">Notes</Heading>
              <Text color="fg.muted">
                Orders placed after a frame’s cut-off arrive in the next day’s matching frame. We balance picking, packing, and routes to hit the promised window.
              </Text>
            </Stack>
          </Card.Body>

          <Card.Footer>
            <HStack gap={3} wrap="wrap">
              <Button asChild colorPalette="teal">
                <RouterLink to="/market">Start shopping</RouterLink>
              </Button>
              <Button asChild variant="outline" colorPalette="purple">
                <RouterLink to="/orders">View your orders</RouterLink>
              </Button>
            </HStack>
          </Card.Footer>
        </Card.Root>

        {/* Who we are */}
        <Card.Root>
          <Card.Header>
            <Card.Title>Who we are</Card.Title>
            <Card.Description>End-to-end visibility from farm to door.</Card.Description>
          </Card.Header>
          <Card.Body>
            <Text mb={3}>
              DFCP is a produce marketplace with built-in quality control and logistics. Farmers manage crops, logistics centers handle sorting and packing, and drivers deliver on precise shifts. Customers see transparent grades and prices.
            </Text>
            <Text color="fg.muted">
              The platform includes ratings, incentives, automated scheduling, and real-time status across the chain.
            </Text>
          </Card.Body>
        </Card.Root>
      </Container>
    </Box>
  );
}
