export type PickerStats = {
coins: number;
level: number;
ordersToday: number;
avgPickTimeMin: number;
streakDays: number;
};


export type LeaderboardEntry = {
id: string;
name: string;
coins: number;
orders: number;
rank: number;
};


export type QuestScope = "day" | "week";


export type Quest = {
id: string;
scope: QuestScope;
title: string;
description: string;
targetOrders: number;
timeLimitMin: number;
rewardCoins: number;
active: boolean;
progress: number;
startedAt?: number;
expiresAt?: number;
};


export type ReadyOrder = {
id: string;
orderId: string;
items: number;
readyForMin: number;
zone: string;
priority: "normal" | "rush";
};