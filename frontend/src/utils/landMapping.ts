// Helpers to normalize farmer lands -> backend shape
const num = (v: any, d: number = 0) =>
  v === "" || v == null || Number.isNaN(Number(v)) ? d : Number(v);

const mapAddress = (a: any) => {
  if (!a) return null;
  // Accept either {lat,lng,formattedAddress} or {alt,lnt,address}
  const alt = a.alt != null ? Number(a.alt) : num(a.lat, undefined as any);
  const lnt = a.lnt != null ? Number(a.lnt) : num(a.lng, undefined as any);
  const address = a.address ?? a.formattedAddress ?? "";
  if (alt == null || lnt == null || !address) return null;
  return { alt, lnt, address };
};

const mapMeasurements = (m: any) => {
  // Allow UIs that capture length/width (rect) or abM/bcM/cdM/daM
  const abM = num(m?.abM ?? m?.length);
  const bcM = num(m?.bcM ?? m?.width);
  // For rectangles, mirror opposite sides if not provided
  const cdM = num(m?.cdM ?? m?.length ?? abM);
  const daM = num(m?.daM ?? m?.width ?? bcM);
  const rotationDeg = m?.rotationDeg == null ? 0 : num(m.rotationDeg);
  return { abM, bcM, cdM, daM, rotationDeg };
};

export const mapLand = (land: any) => {
  const address = mapAddress(
    land?.addressObj ?? {
      address: land?.location,
      alt: land?.locLat,
      lnt: land?.locLng,
    },
  );

  const pickupAddress =
    land?.pickupAddressObj != null
      ? mapAddress(land.pickupAddressObj)
      : land?.pickupAddress
      ? mapAddress({
          address: land.pickupAddress,
          alt: land.pickupLat,
          lnt: land.pickupLng,
        })
      : null;

  const measurements = land?.measurements
    ? mapMeasurements(land.measurements)
    : land?.acres
    ? (() => {
        const m2 = land.acres * 4046.8564224;
        const side = Math.sqrt(m2);
        return { abM: side, bcM: side, cdM: side, daM: side, rotationDeg: 0 };
      })()
    : mapMeasurements({ length: undefined, width: undefined });

  return {
    name: land?.landName ?? "",
    ownership: String(land?.ownership ?? "Owned").toLowerCase() as
      | "owned"
      | "rented",
    address, // required
    pickupAddress, // nullable
    measurements, // required
  };
};
