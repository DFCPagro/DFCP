import * as React from "react";
import {
  Box,
  SimpleGrid,
  Grid,
  GridItem,
  HStack,
  VStack,
  Stack,
  Heading,
  Text,
  Badge,
  Separator,
  Card,
  Button,
  Icon,
  Table,
  Input,
  NativeSelect,
  Skeleton,
  useToken,
 
} from "@chakra-ui/react";
import { useReducedMotion as usePrefersReducedMotion } from "framer-motion";
import {
  PieChart as RPieChart,
  Pie,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Download,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  Package,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  Truck,
  Users,
  RotateCcw,
  SkipForward,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getItemsCatalog } from "@/api/items";

/* ------------------------------------------------
 * Types + API hook
 * ------------------------------------------------ */
type ShiftName = "morning" | "afternoon" | "evening" | "night";
type CategoryKey = "fruit" | "vegetable" | "egg_dairy" | "other";
const CURRENCY = "$";
const THIS_MONTH = "2025-11";

type KPI = {
  orders: number;
  farmerOrders: number;
  revenue: number;
  itemsSold: number;
  complaints: number;
  delta: { ordersPct: number; revenuePct: number; complaintsPct: number };
};

type CategoryRow = { key: CategoryKey; label: string; revenue: number; qtyKg: number };
type DailyRow = { day: number; revenue: number };
type TopItemRow = {
  rank: number;
  itemId?: string;
  item: string;
  category: string;
  qty: number;
  revenue: number;
  imageUrl?: string;
};
type FarmerRow = { farmer: string; shipments: number; qtyKg: number; revenue: number };
type ShiftRow = { shift: ShiftName; orders: number; revenue: number };

type MonthlyAnalytics = {
  month: string;
  kpi: KPI;
  salesByCategory: CategoryRow[];
  dailyRevenue: DailyRow[];
  topItems: TopItemRow[];
  farmerContribution: FarmerRow[];
  shiftSales: ShiftRow[];
};

type ItemCatalogEntry = {
  _id: string;
  category: string;
  type: string;
  variety?: string;
  imageUrl?: string;
};

async function fetchMonthlyAnalytics(month: string): Promise<MonthlyAnalytics> {
  // TODO: replace with your real API call
  const kpi: KPI = {
    orders: 223,
    farmerOrders: 123,
    revenue: 67230,
    itemsSold: 1737,
    complaints: 12,
    delta: { ordersPct: 20.5, revenuePct: 17.0, complaintsPct: -20.0 },
  };
  const salesByCategory: CategoryRow[] = [
    { key: "fruit", label: "Fruits", revenue: 22300, qtyKg: 520 },
    { key: "vegetable", label: "Vegetables", revenue: 15800, qtyKg: 650 },
    { key: "egg_dairy", label: "Eggs & Dairy", revenue: 7000, qtyKg: 210 },
    { key: "other", label: "Other", revenue: 67230 - (22300 + 15800 + 7000), qtyKg: 57 },
  ];
  const dailyRevenue: DailyRow[] = Array.from({ length: 30 }).map((_, i) => ({
    day: i + 1,
    revenue: Math.round(400 + Math.random() * 3000),
  }));
  const topItems: TopItemRow[] = [
    { rank: 1, itemId: "68960284330bf1699eee8955", item: "Lettuce Romaine", category: "Vegetable", qty: 320, revenue: 3200 },
    { rank: 2, itemId: "68960284330bf1699eee8950", item: "Apple Fuji", category: "Fruit", qty: 210, revenue: 2500 },
    { rank: 3, itemId: "6896056443caa05518908c20", item: "Eggs Free Range (12)", category: "Eggs & Dairy", qty: 180, revenue: 2700 },
    { rank: 4, itemId: "68960284330bf1699eee8956", item: "Cucumber Persian", category: "Vegetable", qty: 260, revenue: 1820 },
    { rank: 5, itemId: "68960284330bf1699eee8952", item: "Orange Navel", category: "Fruit", qty: 190, revenue: 2050 },
  ];
  const farmerContribution: FarmerRow[] = [
    { farmer: "Levy Cohen", shipments: 22, qtyKg: 410, revenue: 8900 },
    { farmer: "Ayala Ben-David", shipments: 18, qtyKg: 360, revenue: 8100 },
    { farmer: "Yousef Haddad", shipments: 14, qtyKg: 290, revenue: 6700 },
    { farmer: "Maya Klein", shipments: 11, qtyKg: 240, revenue: 5200 },
    { farmer: "Tomer Azulay", shipments: 9, qtyKg: 210, revenue: 4330 },
  ];
  const shiftSales: ShiftRow[] = [
    { shift: "afternoon", orders: 88, revenue: 19200 },
    { shift: "morning", orders: 72, revenue: 15400 },
    { shift: "evening", orders: 55, revenue: 12100 },
    { shift: "night", orders: 10, revenue: 530 },
  ];
  return { month, kpi, salesByCategory, dailyRevenue, topItems, farmerContribution, shiftSales };
}

function useMonthlyAnalytics(month: string) {
  return useQuery({
    queryKey: ["analytics", "monthly", month],
    queryFn: () => fetchMonthlyAnalytics(month),
  });
}

/* ------------------------------------------------
 * Helpers & colors
 * ------------------------------------------------ */
function pctStr(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}
function usd(n: number) {
  return `${CURRENCY}${n.toLocaleString()}`;
}
function useCategoryColors() {
  const [green500, teal500, orange500, gray500] = useToken("colors", [
    "green.500",
    "teal.500",
    "orange.500",
    "gray.500",
  ]);
  return {
    fruit: teal500,
    vegetable: green500,
    egg_dairy: orange500,
    other: gray500,
  } as Record<CategoryKey, string>;
}
function hexToRgba(hex: string, alpha: number) {
  const v = hex.replace("#", "");
  const bigint = parseInt(v.length === 3 ? v.split("").map((c) => c + c).join("") : v, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function displayNameFromCatalog(entry?: ItemCatalogEntry) {
  if (!entry) return "";
  return entry.variety ? `${entry.type} ${entry.variety}` : entry.type;
}

/* ------------------------------------------------
 * Reusable: KPI & CardSection
 * ------------------------------------------------ */
function KPI({
  icon,
  label,
  value,
  delta,
  help,
  badgeColorOverride,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  delta?: number;
  help?: string;
  badgeColorOverride?: "red" | "green";
}) {
  const isBad = delta !== undefined && delta < 0;
  const badgeColor = badgeColorOverride ?? (isBad ? "red" : "green");
  return (
    <Card.Root variant="subtle" p={4}>
      <Stack gap={3}>
        <HStack justifyContent="space-between" alignItems="center">
          <HStack>
            <Icon as={icon} />
            <Text color="gray.600" fontSize="sm" textTransform="uppercase" letterSpacing="widest">
              {label}
            </Text>
          </HStack>
          {delta !== undefined && (
            <Badge colorPalette={badgeColor} variant="solid">
              {pctStr(delta)}
            </Badge>
          )}
        </HStack>
        <Heading size="lg">{value}</Heading>
        {help ? (
          <Text color="gray.600" fontSize="sm">
            {help}
          </Text>
        ) : null}
      </Stack>
    </Card.Root>
  );
}

function CardSection({
  title,
  icon,
  right,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card.Root variant="outline">
      <Card.Header px={4} py={3} borderBottomWidth="1px">
        <HStack justifyContent="space-between" alignItems="center" w="full">
          <HStack>
            {icon ? <Icon as={icon} /> : null}
            <Card.Title>{title}</Card.Title>
          </HStack>
          {right ?? null}
        </HStack>
      </Card.Header>
      <Card.Body p={0}>{children}</Card.Body>
    </Card.Root>
  );
}

/* ------------------------------------------------
 * Charts
 * ------------------------------------------------ */
function CategoryPie({ data }: { data: CategoryRow[] }) {
  const colors = useCategoryColors();
  const pie = data.map((d) => ({ ...d, fill: colors[d.key] }));
  return (
    <Box h="320px" px={3} py={2}>
      <ResponsiveContainer width="100%" height="100%">
        <RPieChart>
          <Tooltip formatter={(v: number) => usd(v)} />
          <Legend />
          <Pie dataKey="revenue" data={pie} innerRadius={60} outerRadius={100} paddingAngle={2} nameKey="label">
            {pie.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} />
            ))}
          </Pie>
        </RPieChart>
      </ResponsiveContainer>
    </Box>
  );
}

function DailyRevenueLine({ data }: { data: DailyRow[] }) {
  return (
    <Box h="320px" px={3} py={2}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis domain={[0, (dataMax: number) => dataMax * 1.2]} />
          <Tooltip formatter={(v: number) => usd(v)} />
          <Legend />
          <Line type="monotone" dataKey="revenue" name={`Revenue (${CURRENCY})`} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

function FarmerContributionBar({ data }: { data: FarmerRow[] }) {
  const [green500] = useToken("colors", ["green.500"]);
  return (
    <Box h="280px" px={3} py={2}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="farmer" />
          <YAxis />
          <Tooltip formatter={(v: number) => usd(v)} />
          <Legend />
          <Bar dataKey="revenue" name={`Revenue (${CURRENCY})`} fill={hexToRgba(green500, 0.45)} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

/* ------------------------------------------------
 * Shift Summary TABLE (sorted by revenue desc)
 * ------------------------------------------------ */
function ShiftSummaryTable({ rows }: { rows: ShiftRow[] }) {
  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = sorted.reduce((s, r) => s + r.revenue, 0);
  return (
    <Box p={4}>
      <Table.Root size="sm" width="full">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>#</Table.ColumnHeader>
            <Table.ColumnHeader>Shift</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Orders</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Revenue ({CURRENCY})</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Share</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {sorted.map((r, i) => (
            <Table.Row key={r.shift}>
              <Table.Cell>{i + 1}</Table.Cell>
              <Table.Cell>
                <Badge variant={i === 0 ? "solid" : "subtle"}>{r.shift}</Badge>
              </Table.Cell>
              <Table.Cell textAlign="end">{r.orders.toLocaleString()}</Table.Cell>
              <Table.Cell textAlign="end">{usd(r.revenue)}</Table.Cell>
              <Table.Cell textAlign="end">
                {totalRevenue ? `${((r.revenue / totalRevenue) * 100).toFixed(1)}%` : "—"}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}

/* ------------------------------------------------
 * AI Insights Sidebar (UPDATED)
 * ------------------------------------------------ */
/* ------------------------------------------------
 * AI Insights — Bullets with bold headings + typing effect
 * ------------------------------------------------ */
type AIProps = {
  kpi: KPI;
  topItems: TopItemRow[];
  categories: CategoryRow[];
  daily: DailyRow[];
  shiftSales: ShiftRow[];
};

export function AIInsightsSidebar({
  kpi,
  topItems,
  categories,
  daily,
  shiftSales,
}: AIProps) {
  // ---- derive insights
  const bestItem = [...topItems].sort((a, b) => a.rank - b.rank)[0];
  const bestCategory = [...categories].sort((a, b) => b.revenue - a.revenue)[0];
  const spike = daily.length
    ? daily.reduce((acc, r) => (r.revenue > acc.revenue ? r : acc), daily[0])
    : undefined;
  const busiestShift = shiftSales.length
    ? [...shiftSales].sort((a, b) => b.orders - a.orders)[0]
    : undefined;
  const revChange = kpi?.delta?.revenuePct ?? 0;

  // ---- bullet definitions (label + text)
  const bullets = React.useMemo(
    () => {
      if (!bestItem || !bestCategory || !spike || !busiestShift)
        return [{ label: "Info", text: "Insufficient data to generate insights." }];

      const dir = revChange >= 0 ? "up" : "down";
      const pct = `${revChange >= 0 ? "+" : ""}${revChange.toFixed(1)}%`;
      return [
        { label: "Best category", text: `${bestCategory.label} — ${usd(bestCategory.revenue)}` },
        { label: "Top item", text: `${bestItem.item} (${bestItem.category}) — ${bestItem.qty} units, ${usd(bestItem.revenue)}` },
        { label: "Revenue trend", text: `${dir} ${pct} vs last month` },
        { label: "Sales spike", text: `Day ${spike.day} — ${usd(spike.revenue)}` },
        { label: "Busiest shift", text: `${busiestShift.shift} — ${busiestShift.orders} orders, ${usd(busiestShift.revenue)}` },
        { label: "Action", text: `Consider adding more deliverers & pickers for the ${busiestShift.shift} shift to speed up processing` },
      ];
    },
    [bestItem, bestCategory, spike, busiestShift, revChange],
  );

  const prefersReduced = usePrefersReducedMotion();
  const [current, setCurrent] = React.useState(0);
  const [typed, setTyped] = React.useState("");
  const [playing, setPlaying] = React.useState(true);
  const [caretOn, setCaretOn] = React.useState(true);

  // ---- typewriter per bullet
  React.useEffect(() => {
    if (!playing) return;

    if (prefersReduced) {
      setCurrent(bullets.length - 1);
      setTyped(bullets[bullets.length - 1]?.text ?? "");
      setPlaying(false);
      setCaretOn(false);
      return;
    }

    setTyped("");
    let i = 0;
    const text = bullets[current]?.text ?? "";
    const speed = 14;
    const timer = window.setInterval(() => {
      i += 1;
      setTyped(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(timer);
        setTimeout(() => {
          if (current < bullets.length - 1) setCurrent((b) => b + 1);
          else {
            setPlaying(false);
            setCaretOn(false);
          }
        }, 300);
      }
    }, speed);

    return () => window.clearInterval(timer);
  }, [bullets, current, playing, prefersReduced]);

  // caret blink
  React.useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setCaretOn((v) => !v), 500);
    return () => window.clearInterval(t);
  }, [playing]);

  const handleSkip = React.useCallback(() => {
    setPlaying(false);
    setCaretOn(false);
    setCurrent(bullets.length - 1);
    setTyped(bullets[bullets.length - 1]?.text ?? "");
  }, [bullets]);

  const handleReplay = React.useCallback(() => {
    setPlaying(true);
    setCaretOn(true);
    setCurrent(0);
    setTyped("");
  }, []);

  const done = bullets.slice(0, current);
  const live = bullets[current];

  return (
    <Card.Root variant="subtle" p={4} h="full">
      <Stack gap={4}>
        <HStack justifyContent="space-between">
          <HStack>
            <Icon as={TrendingUp} />
            <Heading size="sm">AI Insights</Heading>
          </HStack>
          {playing ? (
            <Button size="xs" variant="solid" colorPalette="green" onClick={handleSkip}>
              Skip
            </Button>
          ) : (
            <Button size="xs" variant="solid" colorPalette="olive" onClick={handleReplay}>
              Replay
            </Button>
          )}
        </HStack>

        <Separator />

        <VStack as="ul" align="stretch" gap={3} aria-live="polite">
          {/* completed bullets */}
          {done.map((b, i) => (
            <HStack as="li" key={i} align="start">
              <Box mt="1" w="2" h="2" borderRadius="full" bg="gray.700" flex="0 0 auto" />
              <Text>
                <b>{b.label}:</b> {b.text}
              </Text>
            </HStack>
          ))}

          {/* active bullet typing */}
          {playing && live && (
            <HStack as="li" align="start">
              <Box mt="1" w="2" h="2" borderRadius="full" bg="gray.700" flex="0 0 auto" />
              <Text>
                <b>{live.label}:</b> {typed}
                <Box
                  as="span"
                  ml="1"
                  w="2"
                  h="4"
                  display="inline-block"
                  bg="currentColor"
                  opacity={caretOn ? 1 : 0}
                />
              </Text>
            </HStack>
          )}
        </VStack>
      </Stack>
    </Card.Root>
  );
}

/* ------------------------------------------------
 * Top Items table (catalog name & image)
 * ------------------------------------------------ */
function TopItemsTable({
  rows,
  catalogById,
}: {
  rows: TopItemRow[];
  catalogById?: Record<string, ItemCatalogEntry>;
}) {
  return (
    <Box p={4}>
      <Table.Root size="sm" width="full">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Rank</Table.ColumnHeader>
            <Table.ColumnHeader>Item</Table.ColumnHeader>
            <Table.ColumnHeader>Category</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Qty</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Revenue ({CURRENCY})</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((r) => {
            const cat = r.itemId ? catalogById?.[r.itemId] : undefined;
            const name = cat ? displayNameFromCatalog(cat) : r.item;
            const img = cat?.imageUrl ?? r.imageUrl;
            return (
              <Table.Row key={r.rank}>
                <Table.Cell>{r.rank}</Table.Cell>
                <Table.Cell>
                  <HStack>
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={name}
                        width={28}
                        height={28}
                        style={{ borderRadius: 6, objectFit: "cover" }}
                      />
                    ) : null}
                    <Text>{name}</Text>
                  </HStack>
                </Table.Cell>
                <Table.Cell>
                  <Badge>{cat?.category ?? r.category}</Badge>
                </Table.Cell>
                <Table.Cell textAlign="end">{r.qty.toLocaleString()}</Table.Cell>
                <Table.Cell textAlign="end">{usd(r.revenue)}</Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}

/* ------------------------------------------------
 * Page
 * ------------------------------------------------ */
export default function AdminMonthlyStatsPage() {
  const [month, setMonth] = React.useState(THIS_MONTH);
  const analytics = useMonthlyAnalytics(month);

  const catalogQ = useQuery<ItemCatalogEntry[]>({
    queryKey: ["items", "catalog"],
    queryFn: getItemsCatalog,
  });
  const catalogById = React.useMemo<Record<string, ItemCatalogEntry>>(
    () => Object.fromEntries((catalogQ.data ?? []).map((e) => [e._id, e])),
    [catalogQ.data],
  );

  return (
    <Box w="full">
      <Stack gap={6}>
        {/* Header */}
        <HStack justifyContent="space-between" alignItems="center">
          <HStack>
            <Icon as={Calendar} />
            <Heading size="lg">Admin · Monthly Statistics</Heading>
          </HStack>
          <HStack gap={3}>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} w="auto" />
            <NativeSelect.Root width="auto">
              <NativeSelect.Field defaultValue="revenue">
                <option value="revenue">Group by revenue</option>
                <option value="qty">Group by quantity</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </HStack>
        </HStack>

        <Separator />

        {/* Loading */}
        {analytics.isLoading ? (
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 5 }} gap={4}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Card.Root key={i} p={4}>
                <Skeleton height="72px" />
              </Card.Root>
            ))}
          </SimpleGrid>
        ) : null}

        {analytics.data ? (
          <>
            {/* KPIs */}
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 5 }} gap={4}>
              <KPI icon={ShoppingCart} label="Total Orders" value={analytics.data.kpi.orders} delta={analytics.data.kpi.delta.ordersPct} />
              <KPI icon={Package} label="Farmer Orders" value={analytics.data.kpi.farmerOrders} />
              <KPI icon={DollarSign} label="Revenue" value={usd(analytics.data.kpi.revenue)} delta={analytics.data.kpi.delta.revenuePct} />
              <KPI icon={BarChart3} label="Items Sold" value={analytics.data.kpi.itemsSold} />
              <KPI icon={AlertTriangle} label="Complaints" value={analytics.data.kpi.complaints} delta={analytics.data.kpi.delta.complaintsPct} badgeColorOverride="red" />
            </SimpleGrid>

            {/* Main + Sidebar */}
            <Grid templateColumns={{ base: "1fr", xl: "2fr 1fr" }} gap={6}>
              <GridItem>
                <Stack gap={6}>
                  {/* TOP ROW: Pie (left) + Shift table (right) */}
                  <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6}>
                    <CardSection
                      title="Sales by Category"
                      icon={PieChartIcon}
                      right={
                        <HStack gap={3}>
                          <Badge variant="subtle">This month</Badge>
                          <Heading size="sm">
                            {usd(analytics.data.salesByCategory.reduce((s, d) => s + d.revenue, 0))}
                          </Heading>
                        </HStack>
                      }
                    >
                      <CategoryPie data={analytics.data.salesByCategory} />
                    </CardSection>

                    <CardSection title="Shift Summary" icon={Users} right={<Badge variant="subtle">Orders & Revenue</Badge>}>
                      <ShiftSummaryTable rows={analytics.data.shiftSales} />
                    </CardSection>
                  </SimpleGrid>

                  {/* WIDE: Daily revenue */}
                  <CardSection
                    title="Revenue by Day"
                    icon={BarChart3}
                    right={<Heading size="sm">{usd(analytics.data.dailyRevenue.reduce((s, d) => s + d.revenue, 0))}</Heading>}
                  >
                    <DailyRevenueLine data={analytics.data.dailyRevenue} />
                  </CardSection>

                  {/* UNDER: Farmer contribution */}
                  <CardSection title="Top 5 Farmer Contribution" icon={Truck} right={<Badge variant="subtle">Revenue</Badge>}>
                    <FarmerContributionBar data={analytics.data.farmerContribution} />
                  </CardSection>

                  {/* Top items */}
                  <CardSection title="Top Items of the Month" icon={BarChart3} right={<Badge>Ranked</Badge>}>
                    <TopItemsTable rows={analytics.data.topItems} catalogById={catalogById} />
                  </CardSection>
                </Stack>
              </GridItem>

              {/* Sidebar */}
              <GridItem>
                <AIInsightsSidebar
                  kpi={analytics.data.kpi}
                  topItems={analytics.data.topItems}
                  categories={analytics.data.salesByCategory}
                  daily={analytics.data.dailyRevenue}
                  shiftSales={analytics.data.shiftSales}
                />
              </GridItem>
            </Grid>
          </>
        ) : null}
      </Stack>
    </Box>
  );
}
