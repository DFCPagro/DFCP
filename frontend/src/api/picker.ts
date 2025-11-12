// src/api/picker.ts
// Client for /api/v1/picker/me. Maps real fields; keeps the rest mocked.

import { api } from "./config";

/* ----------------------------- Public UI type ----------------------------- */
export type PickerProfile = {
  id: string;
  name: string;
  email: string | null;
  level: number;
  xp: number;
  mdCoins: number;
  site: string; // LC display name

  // mocked until backend provides
  streakDays: number;
  shift: { start: string; end: string };
  metrics: { accuracy: number; orders: number; lines: number; speed: number };
  quests: Array<{
    id: string;
    title: string;
    goal: string;
    progress: number;
    reward: number;
  }>;
  achievements: Array<{ id: string; name: string; desc: string }>;
};

/* ----------------------------- API response type ----------------------------- */
/** Shape based on Swagger example for GET /api/v1/picker/me */
type ApiPickerMe = {
  userID: string;
  nickname?: string | null;
  status?: "active" | "suspended" | "left";
  level?: number;
  xp?: number;
  user?: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    mdCoins?: number;
  };
  role?: string;
  logisticCenter?: { id?: string; name?: string; locationName?: string } | null;
  activeStatus?: boolean;
  currentMonthSchedule?: unknown[];
  nextMonthSchedule?: unknown[];
};

/* --------------------------------- Mocks --------------------------------- */
const MOCK_EXTRAS: Omit<
  PickerProfile,
  "id" | "name" | "email" | "level" | "xp" | "mdCoins" | "site"
> = {
  streakDays: 3,
  shift: { start: "08:00", end: "16:00" },
  metrics: { accuracy: 96.4, orders: 128, lines: 940, speed: 118 },
  quests: [
    {
      id: "q1",
      title: "Warm-up",
      goal: "Pick 3 orders",
      progress: 66,
      reward: 25,
    },
    {
      id: "q2",
      title: "Speedster",
      goal: "Maintain 110 l/hr",
      progress: 40,
      reward: 40,
    },
    {
      id: "q3",
      title: "Zero mistakes",
      goal: "100% accuracy today",
      progress: 20,
      reward: 60,
    },
  ],
  achievements: [
    { id: "a1", name: "First shift", desc: "Completed first shift" },
    { id: "a2", name: "100 orders", desc: "Picked 100 orders total" },
  ],
};

/* ------------------------------ Mappers/Utils ----------------------------- */
const toNum = (v: unknown, d = 0) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : d;
};

function mapApiToProfile(row: ApiPickerMe): PickerProfile {
  const site =
    row?.logisticCenter?.locationName ||
    row?.logisticCenter?.name ||
    "Logistics Center";
  return {
    id: String(row?.userID ?? ""),
    name: row?.user?.name ?? row?.nickname ?? "Picker",
    email: row?.user?.email ?? null,
    level: toNum(row?.level, 1),
    xp: toNum(row?.xp, 0),
    mdCoins: toNum(row.user?.mdCoins ?? 0, 0),
    site,
    ...MOCK_EXTRAS,
  };
}

/* --------------------------------- API ----------------------------------- */
/**
 * Fetch picker profile.
 * If your api baseURL already includes `/api/v1`, use `/picker/me`.
 * If not, change to `/api/v1/picker/me`.
 */
export async function fetchPickerProfile(): Promise<PickerProfile> {
  const path = "/picker/me";
  try {
    const res = await api.get<{ data?: ApiPickerMe } | ApiPickerMe>(path);
    const body = (res.data as any)?.data ?? (res.data as ApiPickerMe);
    if (!body) throw new Error("empty");
    return mapApiToProfile(body);
  } catch {
    // Fallback mock on error
    return {
      id: "mock-user",
      name: "Picker Mock",
      email: "picker@example.com",
      level: 4,
      xp: 950,
      mdCoins: 420,
      site: "Zarzir Logistics Center",
      ...MOCK_EXTRAS,
    };
  }
}
