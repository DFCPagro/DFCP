// src/pages/picker/picker-dashboard/api/mock.ts
import type { LeaderboardEntry, PickerStats, Quest, ReadyOrder } from "../types";
import { readyOrders, leaderboard, quests } from "@/data/picker";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const r = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export async function apiFetchStats(): Promise<PickerStats> {
  await delay(200);
  return {
 
    ordersToday: r(10, 28),
    avgPickTimeMin: Number((6 + Math.random() * 4).toFixed(1)),
    streakDays: r(3, 14),
  };
}

// export async function apiFetchLeaderboard(): Promise<LeaderboardEntry[]> {
//   await delay(150);
//   return structuredClone(leaderboard);
// }

export async function apiFetchQuests(): Promise<Quest[]> {
  await delay(150);
  return structuredClone(quests);
}

export async function apiFetchReadyOrders(): Promise<ReadyOrder[]> {
  await delay(250);
  // Map to only the fields your ReadyOrder type expects.
  return readyOrders.map((o) => ({
    id: o.id,
    orderId: o.orderId,
    items: o.items,
    readyForMin: o.readyForMin,
    zone: o.zone,
    priority: o.priority,
  })) as ReadyOrder[];
}

export async function apiClaimOrder(_orderId: string): Promise<{ ok: true }> {
  await delay(120);
  return { ok: true };
}
