import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCustomerAddresses, getAvailableShiftsByLC } from "@/api/market";
import type { Address } from "@/types/address";
import type { AvailableShiftFlat } from "@/types/market";

/** LocalStorage key for persisted selection */
const LS_KEY = "market.selection.v2";


/**
 * We persist the full address snapshot (since your Address type has no `id`)
 * and the selected shift's `marketStockId`.
 */
export type MarketSelection = {
  address: Address;
  marketStockId: string;
};

export type UseMarketActivationOptions = {
  /** If true, we'll keep selection in LS even if it becomes invalid (default false = clear). */
  keepInvalidInStorage?: boolean;

  /** Auto-pick first address + first valid upcoming shift on mount if none exists (default: true). */
  autoActivateOnMount?: boolean;

  /** If provided, use this to decide which shift is "first upcoming". (default: first in array) */
  pickFirstUpcomingShift?: (shifts: AvailableShiftFlat[]) => AvailableShiftFlat | null;
};

export type UseMarketActivation = {
  /** True when we have a valid address+shift */
  isActive: boolean;

  /** Validated address or null */
  address: Address | null;

  /** Validated shift (matched by marketStockId) or null */
  shift: AvailableShiftFlat  | null;

  /** Raw persisted selection (if any) */
  selection: MarketSelection | null;

  /** Loading/error states for validation */
  isLoading: boolean;
  error: string | null;

  /** Set + persist new selection (address snapshot + marketStockId), then validate */
  setSelection: (next: MarketSelection) => Promise<void>;

  /** Clear selection from state + storage */
  clearSelection: () => void;

  /** Re-run server validation for the current selection */
  revalidate: () => Promise<void>;

  autoActivate: () => Promise<boolean>;
};

/* ---------------------------- Storage helpers ---------------------------- */

function readSelection(): MarketSelection | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.marketStockId === "string" &&
      typeof parsed.address?.address === "string" &&
      typeof parsed.address?.lnt === "number" &&
      typeof parsed.address?.alt === "number"
    ) {
      return parsed as MarketSelection;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeSelection(sel: MarketSelection | null) {
  try {
    if (!sel) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, JSON.stringify(sel));
  } catch {
    /* ignore */
  }
}

/* --------------------------- Equality utilities -------------------------- */

/** address equality: compare textual address + coords with a small epsilon */
const EPS = 1e-4; // ~11 meters; avoids float jitter
function sameAddress(a: Address, b: Address): boolean {
  if (!a || !b) return false;
  const sameText = (a.address ?? "").trim() === (b.address ?? "").trim();
  const sameLat = Math.abs((a.alt ?? NaN) - (b.alt ?? NaN)) < EPS;
  const sameLng = Math.abs((a.lnt ?? NaN) - (b.lnt ?? NaN)) < EPS;
  return sameText && sameLat && sameLng;
}

/* ------------------------------ Validation ------------------------------- */
function defaultPickFirstUpcoming(shifts: AvailableShiftFlat[]): AvailableShiftFlat | null {
  // If your API already returns only future shifts sorted ascending, the first is enough.
  return shifts?.length ? shifts[0] : null;
}


async function validateSelection(
  selection: MarketSelection | null,
  opts: UseMarketActivationOptions
): Promise<{ address: Address | null; shift: AvailableShiftFlat | null }> {
  if (!selection) return { address: null, shift: null };

  // 1) Validate address exists in the user's list (match by value, not id)
  const addresses = await getCustomerAddresses();
  const addr =
    addresses.find((a) => sameAddress(a, selection.address)) ?? null;

  if (!addr) {
    return { address: null, shift: null };
  }

  // 2) Validate we can resolve the LC id from the address
  const lcId = addr.logisticCenterId ?? null;
  if (!lcId) {
    // Can't validate shift without LC context
    return { address: addr, shift: null };
  }

  // 3) Validate shift by marketStockId for that LC
  const rows = await getAvailableShiftsByLC(lcId);

  // Map API rows ({ date, shift, marketStockId }) -> AvailableShiftFlat
  const mapped: AvailableShiftFlat[] = (rows ?? [])
    .map((row: any) => {
      const k = String(row.shift ?? "").toLowerCase();
      if (k !== "morning" && k !== "afternoon" && k !== "evening" && k !== "night") return null;
      const d = String(row.date ?? "").slice(0, 10);
      const id = String(row.marketStockId ?? row._id ?? "");
      if (!d || !id) return null;
      return {
        shift: k as AvailableShiftFlat["shift"],
        date: d,
        marketStockId: id,
        slotLabel: (row as any).deliverySlotLabel || undefined, // keep optional if BE adds later
      } as AvailableShiftFlat;
    })
    .filter((x): x is AvailableShiftFlat => x !== null);

  const found = mapped.find((s) => s.marketStockId === selection.marketStockId) ?? null;
  return { address: addr, shift: found };


}

/* ------------------------------- The hook -------------------------------- */

export function useMarketActivation(
  options: UseMarketActivationOptions = {}
): UseMarketActivation {
  const optsRef = useRef<Required<UseMarketActivationOptions>>({
    keepInvalidInStorage: options.keepInvalidInStorage ?? false,
    autoActivateOnMount: options.autoActivateOnMount ?? true,
    pickFirstUpcomingShift: options.pickFirstUpcomingShift ?? defaultPickFirstUpcoming,
  });
  optsRef.current = {
    keepInvalidInStorage: options.keepInvalidInStorage ?? false,
    autoActivateOnMount: options.autoActivateOnMount ?? true,
    pickFirstUpcomingShift: options.pickFirstUpcomingShift ?? defaultPickFirstUpcoming,
  };


  const [selection, setSelectionState] = useState<MarketSelection | null>(() => readSelection());
  const [address, setAddress] = useState<Address | null>(null);
  const [shift, setShift] = useState<AvailableShiftFlat | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = useMemo(() => !!(address && shift), [address, shift]);

  const clearSelection = useCallback(() => {
    writeSelection(null);
    setSelectionState(null);
    setAddress(null);
    setShift(null);
    setError(null);
  }, []);

  const runValidation = useCallback(
    async (sel: MarketSelection | null) => {
      setLoading(true);
      setError(null);
      try {
        const res = await validateSelection(sel, optsRef.current);
        setAddress(res.address);
        setShift(res.shift);

        const valid = !!(res.address && res.shift);
        if (!valid && !optsRef.current.keepInvalidInStorage) {
          writeSelection(null);
          setSelectionState(null);
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to validate market selection");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const setSelection = useCallback(
    async (next: MarketSelection) => {
      writeSelection(next);
      setSelectionState(next);
      await runValidation(next);
    },
    [runValidation]
  );

  const revalidate = useCallback(async () => {
    await runValidation(selection);
  }, [runValidation, selection]);

  const didAutoActivateRef = useRef<boolean>(false);

  const autoActivate = useCallback(async () => {
    if (didAutoActivateRef.current) return false;
    didAutoActivateRef.current = true;

    // 1) Fetch addresses
    const addresses = await getCustomerAddresses();
    const addr = addresses[0];
    if (!addr) {
      // No addresses => remain inactive; drawer can ask user to add one
      return false;
    }

    // 2) Fetch shifts for this address’s LC
    const lcId = addr.logisticCenterId;
    if (!lcId) return false;

    const rows = await getAvailableShiftsByLC(lcId);
    const mapped: AvailableShiftFlat[] = (rows ?? [])
      .map((row: any) => {
        const k = String(row.shift ?? "").toLowerCase();
        if (k !== "morning" && k !== "afternoon" && k !== "evening" && k !== "night") return null;
        const d = String(row.date ?? "").slice(0, 10);
        const id = String(row.marketStockId ?? row._id ?? "");
        if (!d || !id) return null;
        return {
          shift: k as AvailableShiftFlat["shift"],
          date: d,
          marketStockId: id,
          slotLabel: (row as any).deliverySlotLabel || undefined,
        } as AvailableShiftFlat;
      })
      .filter((x): x is AvailableShiftFlat => x !== null);


    const picker = optsRef.current.pickFirstUpcomingShift ?? defaultPickFirstUpcoming;
    const first = picker(mapped);
    if (!first) return false;

    await setSelection({ address: addr, marketStockId: first.marketStockId });

    return true;
  }, [setSelection]);
  // Validate on first mount based on storage
  useEffect(() => {
    (async () => {
      if (!selection) {
        // No saved selection → try auto-activation if enabled.
        if (optsRef.current.autoActivateOnMount) {
          try {
            const ok = await autoActivate();
            if (ok) return; // setSelection already triggers validation
          } catch {
            // ignore; will fall through to clear
          }
        }
        // Either disabled or failed to auto-activate: clear state to a clean slate
        clearSelection();
        return;
      }
      // We had a selection in LS → validate it
      runValidation(selection);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NEW: If validation cleared an invalid saved selection, try auto-activate once.
  useEffect(() => {
    if (!optsRef.current.autoActivateOnMount) return;
    if (isActive) return;                     // already active, nothing to do
    if (selection !== null) return;           // still have a saved selection, don't auto-pick yet
    // selection is null AND we're inactive -> try once
    void autoActivate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, isActive]);

  
 
  return {
    isActive,
    address,
    shift,
    selection,
    isLoading,
    error,
    setSelection,
    clearSelection,
    revalidate,
    autoActivate,
  };
}
