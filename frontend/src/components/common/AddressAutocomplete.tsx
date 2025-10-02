import { useEffect, useRef } from "react";
import { Input, type InputProps } from "@chakra-ui/react";
import { loadGoogleMaps } from "@/utils/googleMaps";

type Props = Omit<InputProps, "onChange" | "value"> & {
  value: string;
  onChange: (val: string) => void;
  onPlaceSelected?: (payload: { address: string; lat?: number; lng?: number }) => void;
  /** Optional country restriction, e.g. "IL" or "US,CA" */
  countries?: string;
};

let pacStyleInjected = false;
function ensurePacZIndexStyle() {
  if (pacStyleInjected) return;
  const style = document.createElement("style");
  style.textContent = `
    .pac-container { z-index: 2147483647 !important; } /* sit above dialogs/tooltips */
  `;
  document.head.appendChild(style);
  pacStyleInjected = true;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  countries,
  ...rest
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const pacContainerRef = useRef<HTMLElement | null>(null);

  // Keep latest callbacks (avoid effect deps on function identity)
  const onChangeRef = useRef(onChange);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onPlaceSelectedRef.current = onPlaceSelected; }, [onPlaceSelected]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Make sure Maps + Places lib are loaded (v2 importLibrary under the hood)
      await loadGoogleMaps();
      if (cancelled || !inputRef.current) return;

      ensurePacZIndexStyle();

      const g = (window as any).google as typeof google;

      const opts: google.maps.places.AutocompleteOptions = {
        fields: ["formatted_address", "geometry", "place_id"],
        types: ["geocode"],
      };

      if (countries) {
        const list = countries.split(",").map((s) => s.trim()).filter(Boolean);
        opts.componentRestrictions = { country: list.length <= 1 ? list[0] : list };
      }

      // Create Autocomplete instance
      const ac = new g.maps.places.Autocomplete(inputRef.current, opts);
      acRef.current = ac;

      // Capture the pac-container Google just appended to <body>
      setTimeout(() => {
        const all = Array.from(document.querySelectorAll(".pac-container")) as HTMLElement[];
        pacContainerRef.current = all[all.length - 1] ?? null;
      }, 0);

      // Prevent Enter from submitting forms while a suggestion is being chosen
      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Enter") {
          ev.stopPropagation();
          // Let Google handle the selection; avoid form submit
          ev.preventDefault();
        }
      };
      inputRef.current.addEventListener("keydown", onKeyDown);

      // place_changed handler
      listenerRef.current = ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        const address = place.formatted_address || inputRef.current!.value;
        const lat = place.geometry?.location?.lat();
        const lng = place.geometry?.location?.lng();
        onChangeRef.current(address);
        onPlaceSelectedRef.current?.({ address, lat, lng });
      });

      // Cleanup
      return () => {
        inputRef.current?.removeEventListener("keydown", onKeyDown);
      };
    })();

    return () => {
      cancelled = true;
      try {
        listenerRef.current?.remove();
        listenerRef.current = null;
        acRef.current = null;

        // Remove the specific PAC container created for this instance
        // (prevents .pac-container piling up when component unmounts)
        pacContainerRef.current?.remove();
        pacContainerRef.current = null;
      } catch {}
    };
  }, [countries]);

  return (
    <Input
      ref={inputRef}
      value={value}
      // important: avoid browser autofill fighting with Google PAC
      autoComplete="off"
      // keep parent onChange wired
      onChange={(e) => onChangeRef.current(e.target.value)}
      placeholder="Search address"
      {...rest}
    />
  );
}
