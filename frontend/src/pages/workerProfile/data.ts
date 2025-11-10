// src/pages/workerProfile/data.ts
export type Quest = { id: string; title: string; goal: string; progress: number; reward: string };
export type Achievement = { id: string; name: string; desc: string };

export type PickerProfile = {
  id: string;
  name: string;
  role: "picker";
  email: string;
  phone: string;
  site: string;
  shift: { start: string; end: string };

  // desktop “player” layer
  title: string;
  rank: string;
  level: number;
  xp: number;          // total XP (1000 per level)
  mdCoins: number;
  streakDays: number;
  badges: string[];

  metrics: { orders: number; lines: number; accuracy: number; speed: number };
  cartId: string;
  scannerId: string;
  scannerBattery: number;

  quests: Quest[];
  achievements: Achievement[];
};

export const fetchPickerProfile = async (): Promise<PickerProfile> => ({
  id: "PKR-1042",
  name: "Alex Rivera",
  role: "picker",
  email: "alex.rivera@example.com",
  phone: "+1 415 555 0134",
  site: "Warehouse A • Zone A1",
  shift: { start: "08:00", end: "16:00" },

  title: "Speed Runner",
  rank: "Gold III",
  level: 5,
  xp: 4320,
  mdCoins: 215,
  streakDays: 6,
  badges: ["Fast Starter", "Perfect SLA", "Zero Errors"],

  metrics: { orders: 12, lines: 86, accuracy: 99.2, speed: 28 },

  cartId: "C-17",
  scannerId: "SC-903",
  scannerBattery: 76,

  quests: [
    { id: "q1", title: "Warm-up", goal: "Pick 3 orders", progress: 100, reward: "+50 XP" },
    { id: "q2", title: "No Mistakes", goal: "100% accuracy today", progress: 80, reward: "+120 XP" },
    { id: "q3", title: "Sprinter", goal: "30 lines / hr", progress: 60, reward: "+90 XP" },
  ],
  achievements: [
    { id: "a1", name: "Perfect SLA", desc: "Completed 10 rush orders on time" },
    { id: "a2", name: "Zero Errors", desc: "500 lines without mistakes" },
    { id: "a3", name: "Early Bird", desc: "Clocked in before 08:00 for 5 days" },
  ],
});

export const savePreferences = async (prefs: {
  nickname: string;
  audio: boolean;
  haptics: boolean;
  available: boolean;
}) => {
  await new Promise((r) => setTimeout(r, 300));
  return true;
};
