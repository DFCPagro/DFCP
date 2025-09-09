    import { useEffect, useState } from "react";
import { fetchShiftsForLocation } from "@/api/market";
import type { ShiftOption, ShiftCode } from "@/types/market";

type Props = {
  locationId?: string;
  value?: ShiftCode;
  onChange: (shift: ShiftCode) => void;
};

export default function ShiftPicker({ locationId, value, onChange }: Props) {
  const [opts, setOpts] = useState<ShiftOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) { setOpts([]); return; }
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchShiftsForLocation(locationId);
        if (mounted) setOpts(res);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [locationId]);

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium">Delivery shift</label>
      <select
        className="border rounded px-3 py-2"
        value={value || ""}
        onChange={e => onChange(e.target.value as ShiftCode)}
        disabled={!locationId || loading}
      >
        <option value="" disabled>
          {!locationId ? "Pick a location first" : (loading ? "Loading..." : "Select shift")}
        </option>
        {opts.map(o => (
          <option key={o.code} value={o.code} disabled={o.remainingSkus === 0}>
            {o.label} {o.remainingSkus === 0 ? "— Sold out" : `— ${o.remainingSkus} items`}
          </option>
        ))}
      </select>
    </div>
  );
}
