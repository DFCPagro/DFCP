import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSubmitted,
  getTotals,
  groupSubmitted,
  hasAnySubmissionForRow as hasAnySubmissionForRowShared,
  addSubmitted as addSubmittedShared,
  clearSubmitted as clearSubmittedShared,
  type SubmittedContext,
  type SubmittedLine,
  type SubmittedSnapshot,
  type SubmittedGroup,
  type SubmittedTotals,
} from "../shared/submittedOrders.shared.ts";

/* -------------------------------------------------------------------------- */
/*                                Public Types                                */
/* -------------------------------------------------------------------------- */

export type UseSubmittedOrdersResult = {
  /** Raw snapshot from local storage. */
  snapshot: SubmittedSnapshot;
  /** Convenience: just the lines array. */
  lines: SubmittedLine[];
  /** Derived totals (count & sum kg). */
  totals: SubmittedTotals;
  /** Grouped by itemId + type + variety for the summary dialog. */
  groups: SubmittedGroup[];
  /** Check if a row has any submission(s) already. */
  isSubmitted: (rowKey: string) => boolean;
  /** Append a submission line (context required). */
  add: (line: SubmittedLine) => void;
  /** Clear all submissions (use on Confirm) and optionally persist next context. */
  clear: () => void;
};

/* -------------------------------------------------------------------------- */
/*                            useSubmittedOrders Hook                          */
/* -------------------------------------------------------------------------- */

/**
 * React wrapper around the submitted-orders shared store.
 *
 * @param context  The current page context { date, shift, logisticCenterId, amsId? }.
 *                 This is used to guard against cross-shift contamination when adding.
 *                 (The shared util handles context comparison & clearing if changed.)
 */
export function useSubmittedOrders(
  context: SubmittedContext
): UseSubmittedOrdersResult {
  const [snapshot, setSnapshot] = useState<SubmittedSnapshot>(() =>
    getSubmitted()
  );

  // Keep local state in sync on mount. (Cross-tab sync is not required per your decision.)
  useEffect(() => {
    setSnapshot(getSubmitted());
  }, []);

  const lines = snapshot.lines;

  const totals = useMemo(() => getTotals(), [lines]); // uses storage; lines dep keeps it fresh
  const groups = useMemo(() => groupSubmitted(lines), [lines]);

  const isSubmitted = useCallback(
    (rowKey: string) => {
      // Prefer checking against our current local snapshot for immediate UI responsiveness.
      // (This mirrors hasAnySubmissionForRowShared but avoids extra storage reads.)
      return (
        lines.some((l) => l.key === rowKey) ||
        hasAnySubmissionForRowShared(rowKey)
      );
    },
    [lines]
  );

  const add = useCallback(
    (line: SubmittedLine) => {
      // Append to storage (will auto-clear if context differs) and refresh local state.
      addSubmittedShared(line, context);
      setSnapshot(getSubmitted());
    },
    [context]
  );

  const clear = useCallback(() => {
    // Clear storage; keep/refresh context if you want to persist it.
    clearSubmittedShared(context);
    setSnapshot({ lines: [] });
  }, [context]);

  return { snapshot, lines, totals, groups, isSubmitted, add, clear };
}

export default useSubmittedOrders;
