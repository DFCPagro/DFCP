// src/pages/adminMonthlyStats/index.tsx
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
  Progress,
  Input,
  NativeSelect,
  Skeleton,
  useToken,
} from "@chakra-ui/react";
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
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

/* ------------------------------------------------
 * Types + API hook (wire this to your backend)
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
type TopItemRow = { rank: number; itemId?: string; item: string; category: string; qty: number; revenue: number; imageUrl?: string };
type FarmerRow = { farmer: string; shipments: number; qtyKg: number; revenue: number };
type ShiftRow = { shift: ShiftName; orders: number; revenue: number };

type MonthlyAnalytics = {
  month: string; // YYYY-MM
  kpi: KPI;
  salesByCategory: CategoryRow[];
  dailyRevenue: DailyRow[];
  topItems: TopItemRow[];
  farmerContribution: FarmerRow[]; // (you said farmer can be excluded in API if needed)
  shiftSales: ShiftRow[];          // NEW: shift summary
};

async function fetchMonthlyAnalytics(month: string): Promise<MonthlyAnalytics> {
  // TODO: replace with your real API:
  // const { data } = await api.get(`/api/analytics/monthly?month=${month}`);
  // return data;

  // ---- Fake fallback (kept from your example) ----
  const kpi: KPI = {
    orders: 223,
    farmerOrders: 123,
    revenue: 45230,
    itemsSold: 1437,
    complaints: 12,
    delta: { ordersPct: 20.5, revenuePct: 17.0, complaintsPct: -20.0 },
  };
  const salesByCategory: CategoryRow[] = [
    { key: "fruit", label: "Fruits", revenue: 18000, qtyKg: 520 },
    { key: "vegetable", label: "Vegetables", revenue: 15800, qtyKg: 650 },
    { key: "egg_dairy", label: "Eggs & Dairy", revenue: 7000, qtyKg: 210 },
    { key: "other", label: "Other", revenue: 45230 - (18000 + 15800 + 7000), qtyKg: 57 },
  ];
  const dailyRevenue: DailyRow[] = Array.from({ length: 30 }).map((_, i) => ({
    day: i + 1,
    revenue: Math.round(400 + Math.random() * 2500),
  }));
  const topItems: TopItemRow[] = [
    { rank: 1, item: "Lettuce Romaine", category: "Vegetable", qty: 320, revenue: 3200, imageUrl: "/img/items/lettuce.jpg" },
    { rank: 2, item: "Apple Fuji", category: "Fruit", qty: 210, revenue: 2500, imageUrl: "/img/items/apple-fuji.jpg" },
    { rank: 3, item: "Eggs Free Range (12)", category: "Eggs & Dairy", qty: 180, revenue: 2700, imageUrl: "/img/items/eggs-12.jpg" },
    { rank: 4, item: "Cucumber Persian", category: "Vegetable", qty: 260, revenue: 1820, imageUrl: "/img/items/cucumber.jpg" },
    { rank: 5, item: "Orange Navel", category: "Fruit", qty: 190, revenue: 2050, imageUrl: "/img/items/orange.jpg" },
  ];
  const farmerContribution: FarmerRow[] = [
    { farmer: "Levy Cohen", shipments: 22, qtyKg: 410, revenue: 8900 },
    { farmer: "Ayala Ben-David", shipments: 18, qtyKg: 360, revenue: 8100 },
    { farmer: "Yousef Haddad", shipments: 14, qtyKg: 290, revenue: 6700 },
    { farmer: "Maya Klein", shipments: 11, qtyKg: 240, revenue: 5200 },
    { farmer: "Tomer Azulay", shipments: 9, qtyKg: 210, revenue: 4330 },
  ];
  const shiftSales: ShiftRow[] = [
    { shift: "morning", orders: 72, revenue: 14400 },
    { shift: "afternoon", orders: 88, revenue: 17200 },
    { shift: "evening", orders: 55, revenue: 10900 },
    { shift: "night", orders: 8, revenue: 730 },
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

/* ------------------------------------------------
 * Reusable: KPI Card (with icons)
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

/* ------------------------------------------------
 * Reusable: CardSection (title + children)
 * ------------------------------------------------ */
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
  const totalRevenue = pie.reduce((s, d) => s + d.revenue, 0);

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
      <VStack mt={-8} pointerEvents="none">
        <Text fontSize="sm" color="gray.600">Total</Text>
        <Heading size="md">{usd(totalRevenue)}</Heading>
      </VStack>
    </Box>
  );
}

function DailyRevenueLine({ data }: { data: DailyRow[] }) {
  return (
    <Box h="240px" px={3} py={2}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis />
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
          {/* lighter color */}
          <Bar dataKey="revenue" name={`Revenue (${CURRENCY})`} fill={hexToRgba(green500, 0.45)} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

/* NEW: Shift Summary (which shift sells the most) */
function ShiftSummaryBar({ data }: { data: ShiftRow[] }) {
  return (
    <Box h="240px" px={3} py={2}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="shift" />
          <YAxis />
          <Tooltip formatter={(v: number) => usd(v)} />
          <Legend />
          <Bar dataKey="orders" name="Orders" />
          <Bar dataKey="revenue" name={`Revenue (${CURRENCY})`} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

/* ------------------------------------------------
 * AI Insights (sidebar) – now includes staffing tip by shift
 * ------------------------------------------------ */
function AIInsightsSidebar({ kpi, topItems, categories, daily, shiftSales }: {
  kpi: KPI; topItems: TopItemRow[]; categories: CategoryRow[]; daily: DailyRow[]; shiftSales: ShiftRow[];
}) {
  const bestItem = topItems[0];
  const bestCategory = categories.slice().sort((a, b) => b.revenue - a.revenue)[0];
  const revChange = kpi.delta.revenuePct;
  const spike = daily.reduce((acc, r) => (r.revenue > acc.revenue ? r : acc), { day: 1, revenue: 0 });
  const busiestShift = shiftSales.slice().sort((a, b) => b.orders - a.orders)[0];

  return (
    <Card.Root variant="subtle" p={4} h="full">
      <Stack gap={4}>
        <HStack justifyContent="space-between" alignItems="center">
          <Heading size="sm">AI Insights</Heading>
          <Icon as={TrendingUp} />
        </HStack>
        <Separator />
        <VStack alignItems="flex-start" gap={3}>
          <Text><b>Best category:</b> {bestCategory.label} — {usd(bestCategory.revenue)}</Text>
          <Text>
            <b>Top item:</b> {bestItem.item} ({bestItem.category}), {bestItem.qty} units, {usd(bestItem.revenue)}
          </Text>
          <Text><b>Revenue trend:</b> {revChange >= 0 ? "Up" : "Down"} {pctStr(revChange)} vs last month.</Text>
          <Text><b>Sales spike:</b> Day {spike.day} with {usd(spike.revenue)}</Text>
          <Text>
            <b>Busiest shift:</b> {busiestShift.shift} — {busiestShift.orders} orders, {usd(busiestShift.revenue)}
          </Text>
          <HStack color="green.700">
            <Icon as={Truck} />
            <Text>
              <b>Action:</b> For <b>{busiestShift.shift}</b>, consider adding <b>deliverers</b> and <b>pickers</b> to speed up processing.
            </Text>
          </HStack>
        </VStack>
        <Separator />
        <HStack wrap="wrap" gap={2}>
          <Button size="sm" variant="solid" colorPalette="green">
            <Icon as={Download} mr="2" /> Download CSV
          </Button>
          <Button size="sm" variant="outline">
            <Icon as={Download} mr="2" /> Export PDF
          </Button>
        </HStack>
      </Stack>
    </Card.Root>
  );
}

/* ------------------------------------------------
 * Tables
 * ------------------------------------------------ */
function TopItemsTable({ rows }: { rows: TopItemRow[] }) {
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
          {rows.map((r) => (
            <Table.Row key={r.rank}>
              <Table.Cell>{r.rank}</Table.Cell>
              <Table.Cell>
                <HStack>
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt={r.item} width={28} height={28} style={{ borderRadius: 6 }} />
                  ) : null}
                  <Text>{r.item}</Text>
                </HStack>
              </Table.Cell>
              <Table.Cell><Badge>{r.category}</Badge></Table.Cell>
              <Table.Cell textAlign="end">{r.qty.toLocaleString()}</Table.Cell>
              <Table.Cell textAlign="end">{usd(r.revenue)}</Table.Cell>
            </Table.Row>
          ))}
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

        {/* Loading state */}
        {analytics.isLoading ? (
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 5 }} gap={4}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Card.Root key={i} p={4}><Skeleton height="72px" /></Card.Root>
            ))}
          </SimpleGrid>
        ) : null}

        {analytics.data ? (
          <>
            {/* KPI Row */}
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
                  {/* Category Pie + Daily Revenue */}
                  <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6}>
                    <CardSection title="Sales by Category" icon={PieChartIcon} right={<Badge variant="subtle">This month</Badge>}>
                      <CategoryPie data={analytics.data.salesByCategory} />
                    </CardSection>

                    <CardSection title="Revenue by Day" icon={BarChart3}>
                      <DailyRevenueLine data={analytics.data.dailyRevenue} />
                    </CardSection>
                  </SimpleGrid>

                  {/* Shift summary */}
                  <CardSection title="Shift Summary" icon={Users} right={<Badge variant="subtle">Orders & Revenue</Badge>}>
                    <ShiftSummaryBar data={analytics.data.shiftSales} />
                  </CardSection>

                  {/* Farmer contribution */}
                  <CardSection title="Farmer Contribution" icon={Truck} right={<Badge variant="subtle">Revenue</Badge>}>
                    <FarmerContributionBar data={analytics.data.farmerContribution} />
                  </CardSection>

                  {/* Top items table */}
                  <CardSection title="Top Items of the Month" icon={BarChart3} right={<Badge>Ranked</Badge>}>
                    <TopItemsTable rows={analytics.data.topItems} />
                  </CardSection>
                </Stack>
              </GridItem>

              {/* Sidebar: AI Insights */}
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
