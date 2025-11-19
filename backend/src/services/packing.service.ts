// src/services/packing.service.ts
// Stateless packing engine — aware of per-item overrides (ItemPacking) and
// a "use bigger box to reduce total box count" heuristic.

import type { ObjectId } from "mongoose";

/* ---------------------------- Public types ---------------------------- */

export type Fragility = "very_fragile" | "fragile" | "normal" | "sturdy";

export type OrderLineLite = {
  itemId: string | ObjectId;
  quantityKg?: number; // kg-mode (produce sold by weight)
  units?: number;      // unit-mode (produce sold by count, eggs, bread, etc.)
  farmerOrderId?: string | ObjectId;
};

export type ItemLite = {
  _id: string | ObjectId;
  name?: string;
  category?: string; // "fruit" | "vegetable" | "egg_dairy" | "other"
  type?: string;
  variety?: string;
  avgWeightPerUnitGr?: number | null;
};

export type ItemPackingOverride = {
  fragility?: Fragility;
  allowMixing?: boolean;
  requiresVentedBox?: boolean;
  minBoxType?: "Small" | "Medium" | "Large";
  maxWeightPerPackageKg?: number; // per single box, cap for THIS item
  maxKgPerBag?: number;           // cap per bag/piece before we split
  densityKgPerL?: number;         // override density for kg→liters
  unitVolLiters?: number;         // fallback liters per unit if no avgWeightPerUnitGr
};

export type PackageSizeLite = {
  key: "Small" | "Medium" | "Large";
  innerDimsCm: { l: number; w: number; h: number };
  headroomPct?: number;
  usableLiters?: number;
  maxWeightKg: number;
  vented?: boolean;

  maxSkusPerBox?: number; // how many distinct SKUs allowed to mix in this box
  mixingAllowed?: boolean; // if false -> only one SKU per box
};

export type ItemPackingById = Record<string, ItemPackingOverride | undefined>;

export type PackingPlan = {
  boxes: Array<{
    boxNo: number;
    boxType: string; // PackageSize.key ("Small" | "Medium" | "Large")
    vented?: boolean;

    estFillLiters: number; // sum of liters inside
    estWeightKg: number;   // sum of estWeightKgPiece of contents
    fillPct: number;       // estFillLiters / usableLiters(box)

    contents: Array<{
      itemId: string;
      itemName?: string;
      farmerOrderId?: string;
      pieceType: "bag" | "bundle";
      mode: "kg" | "unit";
      qtyKg?: number;        // for kg-mode piece
      units?: number;        // for unit-mode piece
      liters: number;
      estWeightKgPiece: number; // NEW: estimated kg for JUST this piece
    }>;
  }>;
  summary: {
    totalBoxes: number;
    byItem: Array<{
      itemId: string;
      itemName?: string;
      bags: number;
      bundles: number;
      totalKg?: number;
      totalUnits?: number;
    }>;
    warnings: string[];
  };
};

// for frontend semantic naming
export type PackedOrder = PackingPlan;

/* --------------------------- Tunable defaults -------------------------- */

// headroom = "don't fill to the lid"
const DEFAULT_HEADROOM = 0.15;

// plastic bag overhead (air, bag volume)
const OVERHEAD_L_PER_BAG = 0.2;

// density by bucket (kg/L)
// If I have 1 kg of "leafy", it will take ~ 1/0.15 ≈ 6.6 liters
const DENSITY: Record<string, number> = {
  leafy: 0.15,
  herbs: 0.15,
  berries: 0.35,
  tomatoes: 0.6,
  cucumbers: 0.6,
  peppers: 0.6,
  apples: 0.65,
  citrus: 0.7,
  roots: 0.8,
  bundled: 0.5,
  generic: 0.5,
};

// fragility bucket defaults
const FRAGILITY: Record<string, Fragility> = {
  leafy: "very_fragile",
  herbs: "very_fragile",
  berries: "fragile",
  tomatoes: "fragile",
  cucumbers: "normal",
  peppers: "normal",
  apples: "normal",
  citrus: "normal",
  roots: "sturdy",
  bundled: "sturdy",
  generic: "normal",
};

// default max kg per bag, based on fragility
const MAX_KG_PER_BAG: Record<Fragility, number> = {
  very_fragile: 0.7,
  fragile: 1.5,
  normal: 2.0,
  sturdy: 3.0,
};

// fallback liters per single unit when we don't know avgWeightPerUnitGr
const UNIT_VOL_FALLBACK: Record<string, number> = {
  berries: 0.06,
  apples: 0.12,
  citrus: 0.12,
  tomatoes: 0.1,
  cucumbers: 0.1,
  peppers: 0.1,
  generic: 0.1,
};

// encourage using a *bigger* box if the small box would be half full or more
// (lower = more aggressive escalation, means fewer total boxes overall)
const ESCALATE_WHEN_FILL_PCT_GE = 0.5;

// when deciding escalation, consider how many SAME-SKU pieces are coming next
const LOOKAHEAD_SAME_ITEM_PIECES = 2;

/* ---------------------------- math helpers ----------------------------- */

function litersFromDimsCm(
  l: number,
  w: number,
  h: number,
  headroomPct = DEFAULT_HEADROOM
) {
  // cm^3 / 1000 = liters
  return (l * w * h * (1 - headroomPct)) / 1000;
}

function usableLiters(box: PackageSizeLite) {
  if (typeof box.usableLiters === "number") return box.usableLiters;
  const hr =
    typeof box.headroomPct === "number" ? box.headroomPct : DEFAULT_HEADROOM;
  return litersFromDimsCm(
    box.innerDimsCm.l,
    box.innerDimsCm.w,
    box.innerDimsCm.h,
    hr
  );
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

/* --------------------- item classification helpers --------------------- */

function bucket(item: ItemLite): string {
  const t = (item.type || "").toLowerCase();
  const v = (item.variety || "").toLowerCase();
  const c = (item.category || "").toLowerCase();

  if (
    c.includes("leaf") ||
    ["lettuce", "spinach", "kale", "chard", "arugula"].some((x) =>
      t.includes(x)
    )
  )
    return "leafy";
  if (t.includes("herb")) return "herbs";

  if (
    t.includes("strawberry") ||
    t.includes("blueberry") ||
    v.includes("berry")
  )
    return "berries";

  if (t.includes("tomato")) return "tomatoes";
  if (t.includes("cucumber")) return "cucumbers";
  if (t.includes("pepper")) return "peppers";
  if (t.includes("apple")) return "apples";

  if (t.includes("orange") || t.includes("mandarin") || c.includes("citrus"))
    return "citrus";

  if (
    ["carrot", "potato", "beet", "root"].some(
      (x) => t.includes(x) || c.includes(x)
    )
  )
    return "roots";

  // eggs / milk / bread = handled like "bundled"
  if (["egg", "bread", "milk"].some((x) => t.includes(x))) return "bundled";

  return "generic";
}

function baseFragility(item: ItemLite): Fragility {
  return FRAGILITY[bucket(item)] ?? "normal";
}

function baseRequiresVented(item: ItemLite): boolean {
  // leafy/herbs/berries/tomatoes are assumed to want airflow
  return ["leafy", "herbs", "berries", "tomatoes"].includes(bucket(item));
}

function allowMixingDefault(f: Fragility): boolean {
  // very_fragile (like lettuce) shouldn't mix with other SKUs
  return f !== "very_fragile";
}

/* ---------------------- volume estimation per piece --------------------- */

function litersFromKg(
  item: ItemLite,
  kg: number,
  overrides?: ItemPackingOverride
) {
  const b = bucket(item);
  const density = overrides?.densityKgPerL ?? DENSITY[b] ?? DENSITY.generic;
  return kg / density;
}

function litersFromUnits(
  item: ItemLite,
  units: number,
  overrides?: ItemPackingOverride
) {
  // if we know avg weight per unit, compute liters via kg
  if (item.avgWeightPerUnitGr && item.avgWeightPerUnitGr > 0) {
    return litersFromKg(
      item,
      (units * item.avgWeightPerUnitGr) / 1000,
      overrides
    );
  }

  // fallback: approximate liters per unit for that bucket
  const b = bucket(item);
  const perUnit =
    overrides?.unitVolLiters ??
    UNIT_VOL_FALLBACK[b] ??
    UNIT_VOL_FALLBACK.generic;
  return units * perUnit;
}

/* --------------------- special-case "bundled" SKUs ---------------------- */

function treatAsBundle(
  item: ItemLite
):
  | {
      enabled: boolean;
      sizeUnits?: number;
      perBundleLiters?: number;
    }
  | undefined {
  const t = (item.type || "").toLowerCase();

  if (t.includes("egg"))
    return { enabled: true, sizeUnits: 12, perBundleLiters: 1.0 };

  if (t.includes("bread"))
    return { enabled: true, sizeUnits: 1, perBundleLiters: 1.2 };

  if (t.includes("milk"))
    return { enabled: true, sizeUnits: 1, perBundleLiters: 1.0 };

  return undefined;
}

/* --------------------------- Piece structure --------------------------- */

type UnitMode = "kg" | "unit";

type Piece = {
  itemId: string;
  itemName?: string;

  pieceType: "bag" | "bundle"; // "bag" = loose/bagged produce, "bundle" = prepack (eggs, bread...)
  mode: UnitMode;

  qtyKg?: number; // for kg-mode bag
  units?: number; // for unit-mode bag/bundle

  liters: number;
  fragility: Fragility;
  allowMixing: boolean;
  requiresVented: boolean;
  minPackageKey?: "Small" | "Medium" | "Large";
  maxWeightPerPackageKg?: number;
};

/* --------------------- estimated weight (kg) helper --------------------- */

function estPieceKg(p: Piece, item?: ItemLite): number {
  // 1. If bag explicitly has qtyKg (kg mode), trust that.
  if (typeof p.qtyKg === "number") {
    return round2(p.qtyKg);
  }

  // 2. If it's units and we know avgWeightPerUnitGr, derive actual total kg.
  if (
    typeof p.units === "number" &&
    item?.avgWeightPerUnitGr &&
    item.avgWeightPerUnitGr > 0
  ) {
    const kg = (p.units * item.avgWeightPerUnitGr) / 1000;
    return round2(kg);
  }

  // 3. fallback heuristic: volume * 0.5 kg/L
  return round2(p.liters * 0.5);
}

/* ---------------------- build Pieces from an order ---------------------- */
/**
 * Rules:
 * - For bundle SKUs (eggs/bread/milk): make multiple "bundle" pieces of fixed size (ex: 12 eggs).
 * - For kg-mode items: split into bags up to cap kg per bag.
 * - For unit-mode produce: create ONE piece for all units (not many mini-bags).
 *   We'll auto-split *later* only if it can't physically fit any box.
 */
function buildPiecesForLine(
  line: OrderLineLite,
  item: ItemLite,
  overrides?: ItemPackingOverride
): Piece[] {
  const mode: UnitMode = typeof line.units === "number" ? "unit" : "kg";

  const f = overrides?.fragility ?? baseFragility(item);
  const vent = overrides?.requiresVentedBox ?? baseRequiresVented(item);
  const mix =
    typeof overrides?.allowMixing === "boolean"
      ? overrides.allowMixing
      : allowMixingDefault(f);
  const minKey = overrides?.minBoxType;

  // 1. Bundle SKUs (eggs, bread, milk...)
  const bundleInfo = treatAsBundle(item);
  if (bundleInfo?.enabled && mode === "unit" && (line.units ?? 0) > 0) {
    const per = Math.max(1, bundleInfo.sizeUnits ?? 1);
    const totalUnits = Math.floor(line.units!);
    const bundleCount = Math.ceil(totalUnits / per);

    const out: Piece[] = [];
    for (let i = 0; i < bundleCount; i++) {
      const u = Math.min(per, totalUnits - i * per);
      out.push({
        itemId: String(item._id),
        itemName: item.name,
        pieceType: "bundle",
        mode: "unit",
        units: u,
        liters: round2(
          bundleInfo.perBundleLiters ??
            litersFromUnits(item, u, overrides)
        ),
        fragility: f,
        allowMixing: true, // bundles assumed sturdy/self-contained
        requiresVented: vent,
        minPackageKey: minKey,
        maxWeightPerPackageKg: overrides?.maxWeightPerPackageKg,
      });
    }
    return out;
  }

  // 2. KG-mode produce -> split by max weight per bag
  if (mode === "kg") {
    const totalKg = Math.max(0, line.quantityKg ?? 0);
    const cap = overrides?.maxKgPerBag ?? (MAX_KG_PER_BAG[f] ?? 2.0);

    const out: Piece[] = [];
    let rem = totalKg;
    while (rem > 0) {
      const bagKg = Math.min(rem, cap);
      out.push({
        itemId: String(item._id),
        itemName: item.name,
        pieceType: "bag",
        mode: "kg",
        qtyKg: round2(bagKg),
        liters: round2(
          litersFromKg(item, bagKg, overrides) + OVERHEAD_L_PER_BAG
        ),
        fragility: f,
        allowMixing: mix,
        requiresVented: vent,
        minPackageKey: minKey,
        maxWeightPerPackageKg: overrides?.maxWeightPerPackageKg,
      });
      rem = round2(rem - bagKg);
    }
    return out;
  }

  // 3. UNIT-mode produce → ONE combined bag/piece for all units (not split).
  const totalUnits = Math.max(0, Math.floor(line.units ?? 0));
  const litersAll = round2(
    litersFromUnits(item, totalUnits, overrides) + OVERHEAD_L_PER_BAG
  );

  return [
    {
      itemId: String(item._id),
      itemName: item.name,
      pieceType: "bag",
      mode: "unit",
      units: totalUnits,
      liters: litersAll,
      fragility: f,
      allowMixing: mix,
      requiresVented: vent,
      minPackageKey: minKey,
      maxWeightPerPackageKg: overrides?.maxWeightPerPackageKg,
    },
  ];
}

/* ------------------ splitting pieces if too large to fit ---------------- */

function pieceFitsLargest(piece: Piece, sizes: PackageSizeLite[]): boolean {
  const largest = [...sizes].sort(
    (a, b) => usableLiters(b) - usableLiters(a)
  )[0];
  if (!largest) return false;

  const estKg =
    typeof piece.qtyKg === "number" ? piece.qtyKg : piece.liters * 0.5;

  return (
    estKg <= largest.maxWeightKg &&
    piece.liters <= usableLiters(largest)
  );
}

// split pieces repeatedly (halves) if they literally can't fit in *any* box we have
function autoSplitIfNeeded(
  piece: Piece,
  sizes: PackageSizeLite[]
): Piece[] {
  if (pieceFitsLargest(piece, sizes)) return [piece];

  const out: Piece[] = [];
  const q: Piece[] = [piece];
  let guard = 0;

  while (q.length && guard < 8) {
    const cur = q.shift()!;
    if (pieceFitsLargest(cur, sizes)) {
      out.push(cur);
      continue;
    }

    // split into A/B halves
    const a: Piece = { ...cur };
    const b: Piece = { ...cur };

    if (typeof cur.qtyKg === "number") {
      a.qtyKg = round2(cur.qtyKg / 2);
      b.qtyKg = round2(cur.qtyKg - a.qtyKg);
    }

    if (typeof cur.units === "number") {
      a.units = Math.floor((cur.units ?? 0) / 2);
      b.units = (cur.units ?? 0) - (a.units ?? 0);
    }

    a.liters = round2(cur.liters / 2);
    b.liters = round2(cur.liters - a.liters);

    q.push(a, b);
    guard++;
  }

  return out.concat(q);
}

/* --------------------- placement & box assignment ---------------------- */

function sortPiecesForPlacement(pieces: Piece[]): Piece[] {
  // sturdy first → they become "bottom layer"
  // very_fragile last → "top layer"
  const rank = (f: Fragility) =>
    f === "sturdy" ? 3 : f === "normal" ? 2 : f === "fragile" ? 1 : 0;

  return [...pieces].sort((a, b) => {
    const rf = rank(a.fragility) - rank(b.fragility);
    if (rf !== 0) return -rf;
    // tie-break: place bigger/heavier bases first
    return b.liters - a.liters;
  });
}

type OpenBox = { type: PackageSizeLite; contents: Piece[] };

function compareKey(
  a: "Small" | "Medium" | "Large",
  b: "Small" | "Medium" | "Large"
) {
  const ord: Record<string, number> = { Small: 1, Medium: 2, Large: 3 };
  return (ord[a] ?? 0) - (ord[b] ?? 0);
}

function canPlaceIn(box: OpenBox, piece: Piece): boolean {
  // ventilation requirement
  if (piece.requiresVented && box.type.vented !== true) return false;

  // min box size gate (ex: lettuce might require >= Medium)
  if (piece.minPackageKey && compareKey(box.type.key, piece.minPackageKey) < 0)
    return false;

  // load check (weight + liters)
  const curKg = box.contents.reduce(
    (s, c) => s + (typeof c.qtyKg === "number" ? c.qtyKg : c.liters * 0.5),
    0
  );
  const curL = box.contents.reduce((s, c) => s + c.liters, 0);

  const addKg =
    typeof piece.qtyKg === "number" ? piece.qtyKg : piece.liters * 0.5;

  const newKg = curKg + addKg;
  const newL = curL + piece.liters;

  if (newKg > box.type.maxWeightKg) return false;
  if (newL > usableLiters(box.type)) return false;

  // box SKU mixing policy
  if (box.type.maxSkusPerBox && box.type.maxSkusPerBox > 0) {
    const distinct = new Set(box.contents.map((c) => c.itemId));
    if (!distinct.has(piece.itemId)) {
      if (distinct.size + 1 > box.type.maxSkusPerBox) return false;
    }
  }

  if (box.type.mixingAllowed === false && box.contents.length > 0) {
    // this box only allows 1 SKU
    if (!box.contents.every((c) => c.itemId === piece.itemId)) return false;
  }

  // piece-level mixing rule (usually very_fragile -> allowMixing=false)
  if (piece.allowMixing === false) {
    const distinct = new Set(box.contents.map((c) => c.itemId));
    if (
      distinct.size > 0 &&
      (!distinct.has(piece.itemId) || distinct.size > 1)
    ) {
      return false;
    }
  }

  // per-item cap inside a single box
  if (piece.maxWeightPerPackageKg && piece.qtyKg) {
    const sameKg = box.contents
      .filter((c) => c.itemId === piece.itemId)
      .reduce((s, c) => s + (c.qtyKg ?? 0), 0);

    if (sameKg + piece.qtyKg > piece.maxWeightPerPackageKg) return false;
  }

  return true;
}

function smallestFeasibleBox(
  piece: Piece,
  sizes: PackageSizeLite[]
): PackageSizeLite | undefined {
  const estKg =
    typeof piece.qtyKg === "number" ? piece.qtyKg : piece.liters * 0.5;

  const candidates = sizes
    .filter((s) => !piece.requiresVented || s.vented === true)
    .filter(
      (s) => estKg <= s.maxWeightKg && piece.liters <= usableLiters(s)
    )
    .sort((a, b) => usableLiters(a) - usableLiters(b));

  if (piece.minPackageKey) {
    return candidates.find(
      (s) => compareKey(s.key, piece.minPackageKey!) >= 0
    );
  }
  return candidates[0];
}

function nextLargerBox(
  base: PackageSizeLite | undefined,
  sizes: PackageSizeLite[],
  ventedNeeded: boolean
) {
  if (!base) return undefined;

  const larger = sizes
    .filter((s) => (!ventedNeeded || s.vented === true))
    .filter((s) => compareKey(s.key, base.key) > 0)
    .sort((a, b) => usableLiters(a) - usableLiters(b));

  return larger[0];
}

function weightOkForBox(box: PackageSizeLite, pieces: Piece[]) {
  const totalKg = pieces.reduce(
    (s, c) => s + (typeof c.qtyKg === "number" ? c.qtyKg : c.liters * 0.5),
    0
  );
  return totalKg <= box.maxWeightKg;
}

// Heuristic: when opening a NEW box for "piece",
// maybe jump to the next bigger size to merge more upcoming pieces and use fewer boxes.
function maybeEscalateBoxChoice(
  piece: Piece,
  smallest: PackageSizeLite | undefined,
  sizes: PackageSizeLite[],
  remainingPieces: Piece[]
) {
  if (!smallest) return smallest;

  const volSmall = usableLiters(smallest);
  const fillPct = piece.liters / (volSmall || 1);

  const next = nextLargerBox(smallest, sizes, piece.requiresVented);
  if (!next) return smallest;

  // Rule 1: if this 1 piece alone would half-fill (or more) the smaller box,
  // escalate to reduce box count later.
  if (fillPct >= ESCALATE_WHEN_FILL_PCT_GE) return next;

  // Rule 2: can we coalesce the next few same-SKU pieces in the next size?
  const sameUpcoming = remainingPieces
    .filter((p) => p.itemId === piece.itemId)
    .slice(0, LOOKAHEAD_SAME_ITEM_PIECES);

  const lookaheadLiters = sameUpcoming.reduce(
    (s, c) => s + c.liters,
    0
  );

  const canMergeInNext =
    piece.liters + lookaheadLiters <= usableLiters(next) &&
    weightOkForBox(next, [piece, ...sameUpcoming]);

  if (canMergeInNext) return next;

  return smallest;
}

/* -------------------------- main core planner -------------------------- */

/**
 * Compute a packing plan given raw lines.
 * (We expose overload signatures below for TS friendliness.)
 */
export function computePackingPlan(
  lines: OrderLineLite[],
  itemsById: Record<string, ItemLite>,
  packageSizes: PackageSizeLite[]
): PackingPlan;
export function computePackingPlan(
  lines: OrderLineLite[],
  itemsById: Record<string, ItemLite>,
  packageSizes: PackageSizeLite[],
  itemPackingById?: ItemPackingById
): PackingPlan;

export function computePackingPlan(
  lines: OrderLineLite[],
  itemsById: Record<string, ItemLite>,
  packageSizes: PackageSizeLite[],
  itemPackingById?: ItemPackingById
): PackingPlan {
  const warnings: string[] = [];

  if (!Array.isArray(packageSizes) || packageSizes.length === 0) {
    return {
      boxes: [],
      summary: {
        totalBoxes: 0,
        byItem: [],
        warnings: ["No package sizes configured."],
      },
    };
  }

  // 1. lines -> Pieces[]
  let pieces: Piece[] = [];
  for (const line of lines) {
    const item = itemsById[String(line.itemId)];
    if (!item) {
      warnings.push(`Item ${String(line.itemId)} not found; skipping.`);
      continue;
    }

    const overrides = itemPackingById?.[String(item._id)];
    const builtPieces = buildPiecesForLine(line, item, overrides);

    for (const p of builtPieces) {
      const splitPieces = autoSplitIfNeeded(p, packageSizes);
      if (splitPieces.length > 1) {
        warnings.push(
          `Auto-split piece of item ${p.itemId} to fit boxes.`
        );
      }
      pieces.push(...splitPieces);
    }
  }

  // 2. sort sturdy -> very_fragile last
  pieces = sortPiecesForPlacement(pieces);

  // 3. greedy placement into boxes
  const openBoxes: OpenBox[] = [];

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];

    // try to drop into an already-open box
    let placed = false;
    for (const box of openBoxes) {
      if (canPlaceIn(box, piece)) {
        box.contents.push(piece);
        placed = true;
        break;
      }
    }
    if (placed) continue;

    // if can't place, open a new box
    const smallest = smallestFeasibleBox(piece, packageSizes);
    if (!smallest) {
      warnings.push(
        `Could not place a piece of item ${piece.itemId} (no feasible box).`
      );
      continue;
    }

    const futurePieces = pieces.slice(i + 1);
    const chosenBoxType = maybeEscalateBoxChoice(
      piece,
      smallest,
      packageSizes,
      futurePieces
    );

    openBoxes.push({ type: chosenBoxType!, contents: [piece] });
  }

  // 4. format boxes for output
  const boxes = openBoxes.map((b, i) => {
    const estL = round2(b.contents.reduce((s, c) => s + c.liters, 0));

    const estKg = round2(
      b.contents.reduce((s, c) => {
        const meta = itemsById[c.itemId];
        return s + estPieceKg(c, meta);
      }, 0)
    );

    const vol = usableLiters(b.type) || 1;

    return {
      boxNo: i + 1,
      boxType: String(b.type.key),
      vented: b.type.vented === true,
      estFillLiters: estL,
      estWeightKg: estKg,
      fillPct: clamp01(estL / vol),

      contents: b.contents.map((c) => {
        const meta = itemsById[c.itemId];
        return {
          itemId: c.itemId,
          itemName: c.itemName,
          pieceType: c.pieceType,
          mode: c.mode,
          qtyKg:
            typeof c.qtyKg === "number" ? round2(c.qtyKg) : undefined,
          units: c.units,
          liters: round2(c.liters),
          estWeightKgPiece: estPieceKg(c, meta),
        };
      }),
    };
  });

  // 5. summary by item
  const byItemMap = new Map<
    string,
    {
      itemId: string;
      itemName?: string;
      farmerOrderId?: string | ObjectId;
      bags: number;
      bundles: number;
      totalKg?: number;
      totalUnits?: number;
    }
  >();

  for (const p of pieces) {
    const key = p.itemId;
    const cur =
      byItemMap.get(key) ?? {
        itemId: key,
        itemName: p.itemName,
        bags: 0,
        bundles: 0,
        totalKg: 0,
        totalUnits: 0,
      };

    if (p.pieceType === "bag") cur.bags += 1;
    else cur.bundles += 1;

    if (typeof p.qtyKg === "number") {
      cur.totalKg = round2((cur.totalKg ?? 0) + p.qtyKg);
    }
    if (typeof p.units === "number") {
      cur.totalUnits = (cur.totalUnits ?? 0) + p.units;
    }

    byItemMap.set(key, cur);
  }

  return {
    boxes,
    summary: {
      totalBoxes: boxes.length,
      byItem: [...byItemMap.values()],
      warnings,
    },
  };
}

/* ---------------- convenience for full order doc ----------------------- */

/**
 * Convenience: feed a full Order document (with .items[] each having
 * itemId, quantity/quantityKg/units) instead of building lines yourself.
 */
export function computePackingForOrderDoc(
  order: {
    items: Array<{
      itemId: string | ObjectId;
      quantity?: number;     // legacy: could be kg
      quantityKg?: number;   // kg explicitly
      units?: number;        // count explicitly
      farmerOrderId?: string | ObjectId;
    }>;
  },
  itemsById: Record<string, ItemLite>,
  packageSizes: PackageSizeLite[]
): PackingPlan;
export function computePackingForOrderDoc(
  order: {
    items: Array<{
      itemId: string | ObjectId;
      quantity?: number;
      quantityKg?: number;
      units?: number;
      farmerOrderId?: string | ObjectId;
    }>;
  },
  itemsById: Record<string, ItemLite>,
  packageSizes: PackageSizeLite[],
  itemPackingById?: ItemPackingById
): PackingPlan;

export function computePackingForOrderDoc(
  order: {
    items: Array<{
      itemId: string | ObjectId;
      quantity?: number;
      quantityKg?: number;
      units?: number;
      farmerOrderId?: string | ObjectId;
    }>;
  },
  itemsById: Record<string, ItemLite>,
  packageSizes: PackageSizeLite[],
  itemPackingById?: ItemPackingById
): PackingPlan {
  const lines: OrderLineLite[] = (order.items || []).map((it) => ({
    itemId: it.itemId,
    quantityKg:
      typeof it.quantityKg === "number"
        ? it.quantityKg
        : typeof it.quantity === "number"
        ? it.quantity
        : undefined,
    units: typeof it.units === "number" ? it.units : undefined,
    farmerOrderId: it.farmerOrderId,
  }));

  return computePackingPlan(
    lines,
    itemsById,
    packageSizes,
    itemPackingById
  );
}
