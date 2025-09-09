import { useEffect, useState } from "react";
import { fetchMyLocations } from "@/api/market";
import type { UserLocation } from "@/types/market";

type Props = {
  value?: string;
  onChange: (locationId: string) => void;
  onAddNew: () => void;
};

export default function LocationPicker({ value, onChange, onAddNew }: Props) {
  const [locations, setLocations] = useState<UserLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchMyLocations();
        if (mounted) setLocations(res);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium">Delivery location</label>
      <div className="flex gap-2">
        <select
          className="border rounded px-3 py-2 flex-1"
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          disabled={loading || locations.length === 0}
        >
          <option value="" disabled>
            {loading ? "Loading..." : "Select a saved location"}
          </option>
          {locations.map(l => (
            <option key={l._id} value={l._id}>
              {l.label || `${l.street}, ${l.city}`}
            </option>
          ))}
        </select>
        <button type="button" className="border rounded px-3 py-2"
                onClick={onAddNew}>+ Add</button>
      </div>
    </div>
  );
}
