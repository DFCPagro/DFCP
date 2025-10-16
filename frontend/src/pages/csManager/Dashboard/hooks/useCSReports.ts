// src/pages/csManagerDashboard/hooks/useCSReports.ts
import { useMemo, useState, useCallback } from "react";

export type ReportStatus = "open" | "in-progress" | "closed";

export type CSReport = {
  id: string;
  subject: string;
  customerName: string;
  customerId?: string;
  createdAt: string;
  createdAtLabel: string;
  status: ReportStatus;
};

export type UseCSReportsOptions = {
  limit?: number;
  status?: ReportStatus | "all";
  search?: string;
  customerId?: string;
};

const NAMES = ["Dana", "Maya", "Yousef", "Itai", "Shirin", "Alex", "Noa", "Omar"] as const;
const SUBJECTS = [
  "Damaged item in order",
  "Late delivery inquiry",
  "Change address request",
  "Missing items in order",
  "Refund status request",
  "Allergy note not applied",
  "Wrong item received",
  "Delivery person feedback",
] as const;
const ORDER_IDS = ["A1B2", "K9Q2", "Z7X3", "M4N8", "H6J1", "P2R5", "C8D0", "T3V9"] as const;

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function sample<T>(arr: readonly T[]) {
  return arr[randInt(0, arr.length - 1)];
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}

function makeMockReport(i: number): CSReport {
  const now = new Date();
  // Spread reports over the last ~48 hours
  const minutesAgo = randInt(5, 48 * 60);
  const dt = new Date(now.getTime() - minutesAgo * 60 * 1000);
  const name = sample(NAMES);
  const orderId = sample(ORDER_IDS);
  const subject = `${sample(SUBJECTS)} #${orderId}`;
  const statuses: ReportStatus[] = ["open", "in-progress", "closed"];
  // Bias to more open/in-progress
  const status = statuses[randInt(0, 4) < 3 ? randInt(0, 1) : 2];

  return {
    id: `r_${i}_${dt.getTime()}`,
    subject,
    customerName: name,
    customerId: `cust_${name.toLowerCase()}`,
    createdAt: dt.toISOString(),
    createdAtLabel: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
    status,
  };
}

export function useCSReports(opts: UseCSReportsOptions = {}) {
  const { limit = 8, status = "all", search = "", customerId } = opts;
  // Changing `nonce` regenerates the dataset (simulates refetch)
  const [nonce, setNonce] = useState(0);

  const reports = useMemo(() => {
    // Generate a base pool, then filter & slice client-side
    const baseCount = Math.max(limit * 2, 20);
    const pool = Array.from({ length: baseCount }, (_, i) => makeMockReport(i + nonce * baseCount));

    const filtered = pool.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (customerId && r.customerId !== customerId) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = `${r.subject} ${r.customerName} ${r.createdAtLabel}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });

    // Newest first
    filtered.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
    return filtered.slice(0, limit);
  }, [limit, status, search, customerId, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return {
    reports,
    isLoading: false,
    isFetching: false,
    error: null as unknown as null,
    refetch,
  };
}
