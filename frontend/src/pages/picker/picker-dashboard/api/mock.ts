// src/pages/picker-dashboard/api/mock.ts
import type { LeaderboardEntry, PickerStats, Quest, ReadyOrder } from "../types";

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
function r(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function apiFetchStats(): Promise<PickerStats> {
  await delay(350);
  return {
    coins: 240 + r(0, 60),
    level: 7,
    ordersToday: r(10, 28),
    avgPickTimeMin: Number((6 + Math.random() * 4).toFixed(1)),
    streakDays: r(3, 14),
  };
}

export async function apiFetchLeaderboard(): Promise<LeaderboardEntry[]> {
  await delay(400);
  const base: LeaderboardEntry[] = Array.from({ length: 10 }).map((_, i) => ({
    id: `u${i + 1}`,
    name: ["Ava", "Ben", "Chloe", "Daniel", "Ella", "Finn", "Grace", "Hugo", "Isla", "Jack"][i],
    coins: r(150, 520),
    orders: r(40, 180),
    rank: i + 1,
  }));
  base[3] = { id: "me", name: "You", coins: 260, orders: 92, rank: 4 };
  return base.sort((a, b) => b.coins - a.coins).map((e, idx) => ({ ...e, rank: idx + 1 }));
}

export async function apiFetchQuests(): Promise<Quest[]> {
  await delay(250);
  return [
    {
      id: "q-day-1",
      scope: "day",
      title: "Quest of the Day",
      description: "Finish 10 orders in 20 min to win extra 10 MD coins",
      targetOrders: 10,
      timeLimitMin: 20,
      rewardCoins: 10,
      active: false,
      progress: 0,
    },
    {
      id: "q-week-1",
      scope: "week",
      title: "Quest of the Week",
      description: "Complete 120 orders this week for +120 MD coins",
      targetOrders: 120,
      timeLimitMin: 60 * 24 * 7,
      rewardCoins: 120,
      active: false,
      progress: 0,
    },
  ];
}

export async function apiFetchReadyOrders(): Promise<ReadyOrder[]> {
  await delay(500);
  const zones = ["A1", "A3", "B2", "B5", "C1", "D4"];
  return Array.from({ length: 12 }).map((_, i) => ({
    id: `rid-${1000 + i}`,
    orderId: `#${23450 + i}`,
    items: r(3, 14),
    readyForMin: r(1, 55),
    zone: zones[r(0, zones.length - 1)],
    priority: Math.random() < 0.25 ? "rush" : "normal",
  }));
}

export async function apiClaimOrder(_orderId: string): Promise<{ ok: true }> {
  await delay(250);
  return { ok: true };
}
