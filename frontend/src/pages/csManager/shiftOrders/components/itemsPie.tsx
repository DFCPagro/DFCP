// ./components/ItemsPie.tsx
import * as React from "react";
import { Box, Text } from "@chakra-ui/react";
import {
  PieChart as RPieChart,
  Pie,
  Tooltip as RTooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";

export type PieDatum = { name: string; value: number };

export default function ItemsPie({
  data,
  metric = "kg",
  total,
  height = 320,
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
  data: PieDatum[];
  metric?: string;
  total?: number;
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
            outerRadius={110}
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

      {typeof total === "number" && (
        <Text mt="2" fontSize="sm" color="fg.muted">
          Total: {total.toLocaleString(undefined, { maximumFractionDigits: 2 })} {metric}
        </Text>
      )}
    </Box>
  );
}
