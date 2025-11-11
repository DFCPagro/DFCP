import * as React from "react";
import {
  Box,
  HStack,
  VStack,
  Text,
  Dialog,
  Table,
  Tabs,
  NativeSelect,
  Tooltip,
  Image,
  Separator,
} from "@chakra-ui/react";
import {
  PieChart as RPieChart,
  Pie,
  Tooltip as RTooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import type { ShiftFarmerOrderItem } from "@/types/farmerOrders";

/* ----------------------- helpers aligned to your types ----------------------- */

function itemNameOf(it: ShiftFarmerOrderItem): string {
  const t = (it as any)?.type ?? "";
  const v = (it as any)?.variety ?? "";
  const both = [t, v].filter(Boolean).join(" ");
  return both || "Unknown item";
}

function itemImageOf(it: ShiftFarmerOrderItem): string | undefined {
  return (
    (it as any)?.pictureUrl ??
    (it as any)?.item?.imageUrl ??
    (it as any)?.item?.pictureUrl ??
    undefined
  );
}

function farmIdentityOf(it: ShiftFarmerOrderItem) {
  const farmName = (it as any)?.farmName ?? (it as any)?.farmerName ?? "Unknown farm";
  // IMPORTANT: use stable id (farmerId/farmId) as key; fallback to name
  const farmKey = (it as any)?.farmerId ?? (it as any)?.farmId ?? farmName;
  return { farmKey: String(farmKey), farmName: String(farmName) };
}

/** Best KG choice: final → forecasted (alias) → forcasted (BE) → sumOrdered */
function qtyKgOf(it: ShiftFarmerOrderItem): number {
  const cand = [
    (it as any)?.finalQuantityKg,
    (it as any)?.forecastedQuantityKg, // FE alias
    (it as any)?.forcastedQuantityKg,  // BE misspelling
    (it as any)?.sumOrderedQuantityKg,
  ];
  for (const v of cand) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

/** Farm logo from the item (canonical: farmLogo) */
function farmLogoOf(it: ShiftFarmerOrderItem): string | undefined {
  return (
    (it as any)?.farmLogo ??
    (it as any)?.farmerLogo ??
    (it as any)?.farmLogoUrl ??
    (it as any)?.farmerLogoUrl ??
    (it as any)?.logoUrl ??
    (it as any)?.farm?.logoUrl ??
    (it as any)?.farmer?.logoUrl ??
    undefined
  );
}

/* ---------------------------- aggregations ---------------------------- */

type FarmRow = {
  farmKey: string;
  farmName: string;
  farmLogo?: string;
  totalKg: number;
  items: Map<string, number>; // itemName -> kg
};

type ItemRow = {
  itemName: string;
  totalKg: number;
  imageUrl?: string;         // representative image for the item
  farms: Map<string, number>; // farmName -> kg
};

function aggregate(items: ShiftFarmerOrderItem[]) {
  const farms = new Map<string, FarmRow>();
  const byItem = new Map<string, ItemRow>();
  let any = false;

  for (const it of items) {
    const kg = qtyKgOf(it);
    if (!(kg > 0)) continue;

    any = true;

    const name = itemNameOf(it);
    const imageUrl = itemImageOf(it);
    const { farmKey, farmName } = farmIdentityOf(it);
    const logo = farmLogoOf(it);

    // farms (BUGFIX: correct map key)
    let f = farms.get(farmKey);
    if (!f) {
      f = { farmKey, farmName, farmLogo: logo, totalKg: 0, items: new Map() };
      farms.set(farmKey, f); // ✅ WAS: farms.set(f, f)
    }
    f.totalKg += kg;
    f.items.set(name, (f.items.get(name) ?? 0) + kg);

    // items
    let r = byItem.get(name);
    if (!r) {
      r = { itemName: name, totalKg: 0, imageUrl, farms: new Map() };
      byItem.set(name, r);
    }
    r.totalKg += kg;
    if (!r.imageUrl && imageUrl) r.imageUrl = imageUrl; // keep first available
    r.farms.set(farmName, (r.farms.get(farmName) ?? 0) + kg);
  }

  const farmsArr = Array.from(farms.values()).sort((a, b) => b.totalKg - a.totalKg);
  const itemsArr = Array.from(byItem.values()).sort((a, b) => b.totalKg - a.totalKg);

  const itemPie = itemsArr.map((r) => ({ name: r.itemName, value: r.totalKg }));
  const farmPie = farmsArr.map((f) => ({ name: f.farmName, value: f.totalKg }));
  const totalKg = itemsArr.reduce((s, r) => s + r.totalKg, 0);

  // cross-filter helpers
  const allFarmNames = farmsArr.map((f) => f.farmName);
  const allItemNames = itemsArr.map((r) => r.itemName);

  function farmBreakdownForItem(itemName: string) {
    // [{ farmName, farmKey, farmLogo, kg }]
    return farmsArr
      .map((f) => ({
        farmKey: f.farmKey,
        farmName: f.farmName,
        farmLogo: f.farmLogo,
        kg: f.items.get(itemName) ?? 0,
      }))
      .filter((x) => x.kg > 0)
      .sort((a, b) => b.kg - a.kg);
  }

  function itemBreakdownForFarm(farmName: string) {
    // [{ itemName, kg, imageUrl }]
    const rows: { itemName: string; kg: number; imageUrl?: string }[] = [];
    const f = farmsArr.find((x) => x.farmName === farmName);
    if (!f) return rows;
    for (const r of itemsArr) {
      const kg = r.farms.get(farmName) ?? 0;
      if (kg > 0) rows.push({ itemName: r.itemName, kg, imageUrl: r.imageUrl });
    }
    return rows.sort((a, b) => b.kg - a.kg);
  }

  return {
    any,
    farmsArr,
    itemsArr,
    itemPie,
    farmPie,
    totalKg,
    allFarmNames,
    allItemNames,
    farmBreakdownForItem,
    itemBreakdownForFarm,
  };
}

/* ------------------------ small UI helpers ------------------------ */

function RoundThumb({
  src,
  name,
  size = 24,
}: {
  src?: string;
  name: string;
  size?: number;
}) {
  return (
    <Tooltip.Root openDelay={250}>
      <Tooltip.Trigger asChild>
        <Box
          as="span"
          w={`${size}px`}
          h={`${size}px`}
          borderRadius="full"
          overflow="hidden"
          border="1px solid"
          borderColor="border"
          bg="bg.muted"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          {src ? (
            <Box
              w="100%"
              h="100%"
              backgroundImage={`url('${src}')`}
              backgroundSize="cover"
              backgroundPosition="center"
            />
          ) : (
            <Text fontSize="2xs" px="1">
              {name?.[0]?.toUpperCase() ?? "?"}
            </Text>
          )}
        </Box>
      </Tooltip.Trigger>
      <Tooltip.Positioner>
        <Tooltip.Content p="2">
          <Tooltip.Arrow />
          {src ? (
            <Image
              src={src}
              alt={name}
              maxW="180px"
              borderRadius="md"
              border="1px solid"
              borderColor="border"
            />
          ) : (
            <Text>No image</Text>
          )}
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
}

function PieBox({
  data,
  total,
  metric = "kg",
  height = 420, // bigger chart
  colors = [
    "var(--chakra-colors-teal-500)",
    "var(--chakra-colors-purple-500)",
    "var(--chakra-colors-blue-500)",
    "var(--chakra-colors-pink-500)",
    "var(--chakra-colors-orange-500)",
    "var(--chakra-colors-green-500)",
    "var(--chakra-colors-cyan-500)",
    "var(--chakra-colors-yellow-500)",
    "var(--chakra-colors-red-500)",
    "var(--chakra-colors-indigo-500)",
  ],
}: {
  data: { name: string; value: number }[];
  total: number;
  metric?: string;
  height?: number;
  colors?: string[];
}) {
  return (
    <Box h={`${height}px`} border="1px solid" borderColor="border" borderRadius="md" p="3">
      <ResponsiveContainer width="100%" height="100%">
        <RPieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={140} // bigger radius
            label={(d: any) => d.name}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <RTooltip
            formatter={(val: number) =>
              `${val.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${metric}`
            }
          />
        </RPieChart>
      </ResponsiveContainer>
      <Text mt="2" fontSize="sm" color="fg.muted">
        Total: {total.toLocaleString(undefined, { maximumFractionDigits: 2 })} {metric}
      </Text>
    </Box>
  );
}

/* ------------------------------ main component ------------------------------ */

export default function FarmerOrdersStatsDialog({
  open,
  onOpenChange,
  date,
  shiftName,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date?: string;
  shiftName?: string;
  items: ShiftFarmerOrderItem[];
}) {
  const {
    any,
    farmsArr,
    itemsArr,
    itemPie,
    farmPie,
    totalKg,
    allFarmNames,
    allItemNames,
    farmBreakdownForItem,
    itemBreakdownForFarm,
  } = React.useMemo(() => aggregate(items), [items]);

  // cross filters
  const [farmFilter, setFarmFilter] = React.useState<string>("(all)");
  const [itemFilter, setItemFilter] = React.useState<string>("(all)");

  // derived pies + totals for filtered states
  const farmTabPie = React.useMemo(() => {
    if (itemFilter === "(all)") return farmPie; // default: totals per farm
    const rows = farmBreakdownForItem(itemFilter); // filter: farms for that item
    const total = rows.reduce((s, r) => s + r.kg, 0);
    return rows.map((r) => ({ name: r.farmName, value: r.kg, _total: total })) as any;
  }, [itemFilter, farmPie, farmBreakdownForItem]);

  const itemTabPie = React.useMemo(() => {
    if (farmFilter === "(all)") return itemPie; // default: totals per item
    const rows = itemBreakdownForFarm(farmFilter); // filter: items for that farm
    const total = rows.reduce((s, r) => s + r.kg, 0);
    return rows.map((r) => ({ name: r.itemName, value: r.kg, _total: total })) as any;
  }, [farmFilter, itemPie, itemBreakdownForFarm]);

  const farmTabTotal = React.useMemo(() => {
    if (itemFilter === "(all)") return totalKg;
    const rows = farmBreakdownForItem(itemFilter);
    return rows.reduce((s, r) => s + r.kg, 0);
  }, [itemFilter, totalKg, farmBreakdownForItem]);

  const itemTabTotal = React.useMemo(() => {
    if (farmFilter === "(all)") return totalKg;
    const rows = itemBreakdownForFarm(farmFilter);
    return rows.reduce((s, r) => s + r.kg, 0);
  }, [farmFilter, totalKg, itemBreakdownForFarm]);

  // precomputed rows (avoid IIFEs in JSX)
  const farmsForSelectedItem = React.useMemo(
    () => (itemFilter === "(all)" ? [] : farmBreakdownForItem(itemFilter)),
    [itemFilter, farmBreakdownForItem]
  );
  const itemsForSelectedFarm = React.useMemo(
    () => (farmFilter === "(all)" ? [] : itemBreakdownForFarm(farmFilter)),
    [farmFilter, itemBreakdownForFarm]
  );

  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          maxW="1100px"
          w="96vw"
          bg="bg.panel"
          border="1px solid"
          borderColor="border"
          borderRadius="xl"
        >
          <Dialog.Header>
            <Dialog.Title>
              Farmer Orders — {date ?? ""} · {shiftName ?? ""}
            </Dialog.Title>
            <Dialog.CloseTrigger />
          </Dialog.Header>

          <Dialog.Body>
            {!any ? (
              <Text color="fg.muted">
                No data available. (Uses: finalQuantityKg → forecastedQuantityKg → forcastedQuantityKg → sumOrderedQuantityKg)
              </Text>
            ) : (
              <Tabs.Root defaultValue="byFarm">
                <Tabs.List>
                  <Tabs.Trigger value="byFarm">By Farm</Tabs.Trigger>
                  <Tabs.Trigger value="byItem">By Item</Tabs.Trigger>
                </Tabs.List>

                <Separator my="3" />

                {/* ---------- BY FARM: Pie, then table (totals by farm). Item filter optional ---------- */}
                <Tabs.Content value="byFarm">
                  <HStack justify="space-between" align="center" mb="3">
                    <Text fontWeight="semibold">
                      {itemFilter === "(all)" ? "All items across farms" : `Farms supplying “${itemFilter}”`}
                    </Text>
                    <HStack gap="2">
                      <Text color="fg.muted">Filter item</Text>
                      <NativeSelect.Root size="sm" aria-label="Filter by item in farm view">
                        <NativeSelect.Field
                          value={itemFilter}
                          onChange={(e) => setItemFilter(e.target.value)}
                        >
                          <option value="(all)">(all)</option>
                          {allItemNames.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </NativeSelect.Field>
                      </NativeSelect.Root>
                    </HStack>
                  </HStack>

                  {/* Chart first */}
                  <Box mb="4">
                    <PieBox data={farmTabPie} total={farmTabTotal} metric="kg" />
                  </Box>

                  {/* Table under the chart */}
                  <Box border="1px solid" borderColor="border" borderRadius="md" p="3">
                    <Table.Root size="sm">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>Farm</Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="end">
                            {itemFilter === "(all)" ? "Total (kg)" : `${itemFilter} (kg)`}
                          </Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {itemFilter === "(all)"
                          ? farmsArr.map((f) => (
                              <Table.Row key={f.farmKey}>
                                <Table.Cell>
                                  <VStack align="start" gap="1">
                                    <HStack gap="3" align="center">
                                      <RoundThumb src={f.farmLogo} name={f.farmName} size={28} />
                                      <Text fontWeight="medium" noOfLines={1} title={f.farmName}>
                                        {f.farmName}
                                      </Text>
                                    </HStack>
                                  </VStack>
                                </Table.Cell>
                                <Table.Cell textAlign="end">{f.totalKg.toFixed(2)}</Table.Cell>
                              </Table.Row>
                            ))
                          : farmsForSelectedItem.length === 0 ? (
                              <Table.Row>
                                <Table.Cell colSpan={2}>
                                  <Text color="fg.muted">No farms supplied this item.</Text>
                                </Table.Cell>
                              </Table.Row>
                            ) : (
                              farmsForSelectedItem.map((row) => (
                                <Table.Row key={row.farmName + ":" + itemFilter}>
                                  <Table.Cell>
                                    <HStack gap="3" align="center">
                                      <RoundThumb src={row.farmLogo} name={row.farmName} size={28} />
                                      <Text fontWeight="medium" noOfLines={1} title={row.farmName}>
                                        {row.farmName}
                                      </Text>
                                    </HStack>
                                  </Table.Cell>
                                  <Table.Cell textAlign="end">{row.kg.toFixed(2)}</Table.Cell>
                                </Table.Row>
                              ))
                            )}
                      </Table.Body>
                    </Table.Root>
                  </Box>
                </Tabs.Content>

                {/* ---------- BY ITEM: Pie, then table (item thumbs) + farm filter ---------- */}
                <Tabs.Content value="byItem">
                  <HStack justify="space-between" align="center" mb="3">
                    <Text fontWeight="semibold">
                      {farmFilter === "(all)" ? "All farms across items" : `Items from “${farmFilter}”`}
                    </Text>
                    <HStack gap="2">
                      <Text color="fg.muted">Filter farm</Text>
                      <NativeSelect.Root size="sm" aria-label="Filter by farm in item view">
                        <NativeSelect.Field
                          value={farmFilter}
                          onChange={(e) => setFarmFilter(e.target.value)}
                        >
                          <option value="(all)">(all)</option>
                          {allFarmNames.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </NativeSelect.Field>
                      </NativeSelect.Root>
                    </HStack>
                  </HStack>

                  {/* Chart first */}
                  <Box mb="4">
                    <PieBox data={itemTabPie} total={itemTabTotal} metric="kg" />
                  </Box>

                  {/* Table under the chart */}
                  <Box border="1px solid" borderColor="border" borderRadius="md" p="3">
                    <Table.Root size="sm">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>Item</Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="end">Kg</Table.ColumnHeader>
                          <Table.ColumnHeader>
                            {farmFilter === "(all)" ? "Farms" : "Farm"}
                          </Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {farmFilter === "(all)"
                          ? itemsArr.map((r) => {
                              const farmsLine = Array.from(r.farms.entries())
                                .sort((a, b) => b[1] - a[1])
                                .map(([farm, kg]) => `${farm} (${kg.toFixed(2)}kg)`)
                                .join(", ");
                              return (
                                <Table.Row key={r.itemName}>
                                  <Table.Cell>
                                    <HStack gap="2" align="center">
                                      <RoundThumb src={r.imageUrl} name={r.itemName} />
                                      <Text fontWeight="medium">{r.itemName}</Text>
                                    </HStack>
                                  </Table.Cell>
                                  <Table.Cell textAlign="end">{r.totalKg.toFixed(2)}</Table.Cell>
                                  <Table.Cell>
                                    <Text fontSize="sm" color="fg.muted" noOfLines={2} title={farmsLine}>
                                      {farmsLine}
                                    </Text>
                                  </Table.Cell>
                                </Table.Row>
                              );
                            })
                          : itemsForSelectedFarm.length === 0 ? (
                              <Table.Row>
                                <Table.Cell colSpan={3}>
                                  <Text color="fg.muted">No items for this farm.</Text>
                                </Table.Cell>
                              </Table.Row>
                            ) : (
                              itemsForSelectedFarm.map((row) => (
                                <Table.Row key={farmFilter + ":" + row.itemName}>
                                  <Table.Cell>
                                    <HStack gap="2" align="center">
                                      <RoundThumb src={row.imageUrl} name={row.itemName} />
                                      <Text fontWeight="medium">{row.itemName}</Text>
                                    </HStack>
                                  </Table.Cell>
                                  <Table.Cell textAlign="end">{row.kg.toFixed(2)}</Table.Cell>
                                  <Table.Cell>
                                    <Text fontSize="sm" color="fg.muted">{farmFilter}</Text>
                                  </Table.Cell>
                                </Table.Row>
                              ))
                            )}
                      </Table.Body>
                    </Table.Root>
                  </Box>
                </Tabs.Content>
              </Tabs.Root>
            )}
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
