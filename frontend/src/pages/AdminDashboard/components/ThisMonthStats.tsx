import * as React from "react"
import {
  Box,
  SimpleGrid,
  HStack,
  VStack,
  Text,
  Badge,
  Tooltip,
  Icon,
  useToken,
} from "@chakra-ui/react"
import { useTheme } from "next-themes"
import { Briefcase, ShoppingCart, Sprout, MessageSquareWarning } from "lucide-react"

/** Static for now — swap to props or query later */
const STATS = [
  {
    key: "jobApplications",
    label: "Job applications",
    value: 17,
    hint: "New applications received this month",
    icon: Briefcase,
    color: "teal",
  },
  {
    key: "orders",
    label: "Orders",
    value: 223,
    hint: "Customer orders placed this month",
    icon: ShoppingCart,
    color: "blue",
  },
  {
    key: "farmerOrders",
    label: "Farmer orders",
    value: 123,
    hint: "Supplier (farmer) orders approved this month",
    icon: Sprout,
    color: "green",
  },
  {
    key: "complaints",
    label: "Complaints",
    value: 12,
    hint: "Customer support complaints opened this month",
    icon: MessageSquareWarning,
    color: "orange",
  },
] as const

type Palette =
  | "teal"
  | "blue"
  | "green"
  | "orange"
  | "purple"
  | "pink"
  | "cyan"
  | "red"
  | "yellow"

/** Chakra v3 uses next-themes for color mode. */
function useThemeValue<T>(light: T, dark: T): T {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === "dark" ? dark : light
}

function StatCard({
  label,
  value,
  Icon: IconComp,
  color,
  hint,
}: {
  label: string
  value: number
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  color: Palette
  hint?: string
}) {
  const bg = useThemeValue("white", "gray.800")
  const iconBg = useThemeValue(`${color}.50`, `${color}.900`)
  const iconFg = useThemeValue(`${color}.600`, `${color}.100`)
  const labelClr = useThemeValue("gray.600", "gray.300")
  const valueClr = useThemeValue("gray.900", "white")

  // v3 CSS variables: --colors-*
  const grad = useThemeValue(
    `linear-gradient(180deg, rgba(0,0,0,0) 70%, var(--colors-${color}-50) 100%)`,
    `linear-gradient(180deg, rgba(255,255,255,0) 70%, var(--colors-${color}-900) 100%)`,
  )

  const ringColor = useToken("colors", `${color}.300`)

  const Card = (
    <Box
      role="group"
      bg={bg}
      borderWidth="1px"
      borderColor={useThemeValue("gray.200", "gray.700")}
      rounded="2xl"
      p={4}
      h="full"
      position="relative"
      overflow="hidden"
      _before={{
        content: '""',
        position: "absolute",
        inset: 0,
        background: grad,
        pointerEvents: "none",
      }}
      transition="transform 140ms ease, box-shadow 140ms ease"
      _hover={{ transform: "translateY(-2px)", shadow: "lg" }}
      _focusWithin={{ outline: "none", boxShadow: `0 0 0 3px ${ringColor}` }}
    >
      <HStack align="center" justify="space-between" mb={2}>
        <HStack>
          <Box
            rounded="full"
            p={2.5}
            bg={iconBg}
            borderWidth="1px"
            borderColor={useThemeValue(`${color}.100`, `${color}.800`)}
          >
            <Icon as={IconComp} fontSize="18px" color={iconFg} />
          </Box>
          <Text fontSize="sm" color={labelClr} noOfLines={1}>
            {label}
          </Text>
        </HStack>
        <Badge variant="subtle" colorPalette={color} rounded="md">
          This month
        </Badge>
      </HStack>

      <VStack align="flex-start" gap="0">
        <Text
          fontSize="2xl"
          fontWeight="extrabold"
          color={valueClr}
          lineHeight="1.15"
          letterSpacing="-0.02em"
        >
          {value.toLocaleString()}
        </Text>
        <Text fontSize="xs" color={labelClr}>
          Total
        </Text>
      </VStack>
    </Box>
  )

  // Chakra v3 Tooltip is namespaced
  return hint ? (
    <Tooltip.Root openDelay={200}>
      <Tooltip.Trigger asChild>{Card}</Tooltip.Trigger>
      <Tooltip.Positioner>
        <Tooltip.Content>{hint}</Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  ) : (
    Card
  )
}

export default function ThisMonthStatsRow() {
  return (
    <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={4} alignItems="stretch" w="full">
      {STATS.map((s) => (
        <StatCard
          key={s.key}
          label={s.label}
          value={s.value}
          Icon={s.icon}
          color={s.color}
          hint={s.hint}
        />
      ))}
    </SimpleGrid>
  )
}
