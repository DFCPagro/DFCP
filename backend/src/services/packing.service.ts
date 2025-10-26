// src/services/packing.service.ts
// Stateless packing engine — uses only Item + PackageSize (no ItemPacking model).

import type { ObjectId } from "mongoose";

export type PackingPlan = {
  boxes: Array<{
    boxNo: number;
    boxType: string;         // PackageSize.key
    vented?: boolean;
    estFillLiters: number;
    estWeightKg: number;
    fillPct: number;         // estFillLiters / usableLiters
    contents: Array<{
      itemId: string;
      pieceType: "bag" | "bundle";
      mode: "kg" | "unit";
      qtyKg?: number;
      units?: number;
      liters: number;
    }>;
  }>;
  summary: {
    totalBoxes: number;
    byItem: Array<{
      itemId: string;
      bags: number;
      bundles: number;
      totalKg?: number;
      totalUnits?: number;
    }>;
    warnings: string[];
  };
};

type UnitMode = "kg" | "unit";
type Fragility = "very_fragile" | "fragile" | "normal" | "sturdy";

export type OrderLineLite = {
  itemId: string | ObjectId;
  quantityKg?: number; // kg-mode
  units?: number;      // unit-mode
  //img url?: string;
};

export type ItemLite = {
  _id: string | ObjectId;
  category?: string;   // "fruit" | "vegetable" | ...
  type?: string;
  variety?: string;
  avgWeightPerUnitGr?: number | null;
};

export type PackageSizeLite = {
  key: string; // "Small" | "Medium" | "Large" | ...
  innerDimsCm: { l: number; w: number; h: number };
  headroomPct?: number;
  usableLiters?: number;
  maxWeightKg: number;
  vented?: boolean;
};

// ---------------- Defaults (no DB changes needed) ----------------
const DEFAULT_HEADROOM = 0.15;
const OVERHEAD_L_PER_BAG = 0.2;

// density by broad bucket (kg/L)
const DENSITY: Record<string, number> = {
  leafy: 0.15, herbs: 0.15, berries: 0.35,
  tomatoes: 0.60, cucumbers: 0.60, peppers: 0.60,
  apples: 0.65, citrus: 0.70, roots: 0.80,
  bundled: 0.50, generic: 0.50,
};

// fragility by bucket
const FRAGILITY: Record<string, Fragility> = {
  leafy: "very_fragile", herbs: "very_fragile",
  berries: "fragile", tomatoes: "fragile",
  cucumbers: "normal", peppers: "normal", apples: "normal", citrus: "normal",
  roots: "sturdy", bundled: "sturdy", generic: "normal",
};

// bag caps (kg) by fragility
const MAX_KG_PER_BAG: Record<Fragility, number> = {
  very_fragile: 0.7, fragile: 1.5, normal: 2.0, sturdy: 3.0,
};

// unit-volume fallback (L/unit) for unit-mode when item avgWeight is unknown
const UNIT_VOL_FALLBACK: Record<string, number> = {
  berries: 0.06, apples: 0.12, citrus: 0.12, tomatoes: 0.10, cucumbers: 0.10, peppers: 0.10, generic: 0.10,
};

function bucket(item: ItemLite): string {
  const t = (item.type || "").toLowerCase();
  const v = (item.variety || "").toLowerCase();
  const c = (item.category || "").toLowerCase();

  if (c.includes("leaf") || ["lettuce","spinach","kale","chard","arugula"].some(x => t.includes(x))) return "leafy";
  if (t.includes("herb")) return "herbs";
  if (t.includes("strawberry") || t.includes("blueberry") || v.includes("berry")) return "berries";
  if (t.includes("tomato")) return "tomatoes";
  if (t.includes("cucumber")) return "cucumbers";
  if (t.includes("pepper")) return "peppers";
  if (t.includes("apple")) return "apples";
  if (t.includes("orange") || t.includes("mandarin") || c.includes("citrus")) return "citrus";
  if (["carrot","potato","beet","root"].some(x => t.includes(x) || c.includes(x))) return "roots";
  if (["egg","bread","milk"].some(x => t.includes(x))) return "bundled";
  return "generic";
}
function fragility(item: ItemLite): Fragility { return FRAGILITY[bucket(item)] ?? "normal"; }
function requiresVented(item: ItemLite): boolean {
  return ["leafy","herbs","berries","tomatoes"].includes(bucket(item));
}
function allowMixingDefault(f: Fragility): boolean { return f !== "very_fragile"; }

function litersFromDimsCm(l:number,w:number,h:number,headroomPct=DEFAULT_HEADROOM){ return (l*w*h*(1-headroomPct))/1000; }
function usableLiters(box: PackageSizeLite) {
  if (typeof box.usableLiters === "number") return box.usableLiters;
  const hr = typeof box.headroomPct === "number" ? box.headroomPct : DEFAULT_HEADROOM;
  return litersFromDimsCm(box.innerDimsCm.l, box.innerDimsCm.w, box.innerDimsCm.h, hr);
}
function litersFromKg(item: ItemLite, kg: number) { return kg / (DENSITY[bucket(item)] || DENSITY.generic); }
function litersFromUnits(item: ItemLite, units: number) {
  if (item.avgWeightPerUnitGr && item.avgWeightPerUnitGr > 0) {
    return litersFromKg(item, (units * item.avgWeightPerUnitGr) / 1000);
  }
  return units * (UNIT_VOL_FALLBACK[bucket(item)] ?? UNIT_VOL_FALLBACK.generic);
}

// treat common SKUs as pre-bundled (by name), no DB flag needed
function treatAsBundle(item: ItemLite): { enabled: boolean; sizeUnits?: number; perBundleLiters?: number } | undefined {
  const t = (item.type || "").toLowerCase();
  if (t.includes("egg"))  return { enabled: true, sizeUnits: 12, perBundleLiters: 1.0 };
  if (t.includes("bread"))return { enabled: true, sizeUnits: 1,  perBundleLiters: 1.2 };
  if (t.includes("milk")) return { enabled: true, sizeUnits: 1,  perBundleLiters: 1.0 };
  return undefined;
}

type Piece = {
  itemId: string;
  pieceType: "bag" | "bundle";
  mode: UnitMode;
  qtyKg?: number;
  units?: number;
  liters: number;
  fragility: Fragility;
  allowMixing: boolean;
  requiresVented: boolean;
  minPackageKey?: string;
  maxWeightPerPackageKg?: number;
};

function buildPiecesForLine(line: OrderLineLite, item: ItemLite): Piece[] {
  const mode: UnitMode = typeof line.units === "number" ? "unit" : "kg";
  const f = fragility(item);
  const vent = requiresVented(item);
  const mix = allowMixingDefault(f);

  // Bundles (eggs/bread/milk) — strong items you want to preserve as units
  const bundle = treatAsBundle(item);
  if (bundle?.enabled && mode === "unit" && (line.units ?? 0) > 0) {
    const per = Math.max(1, bundle.sizeUnits ?? 1);
    const total = Math.floor(line.units!);
    const n = Math.ceil(total / per);
    const out: Piece[] = [];
    for (let i = 0; i < n; i++) {
      const u = Math.min(per, total - i * per);
      out.push({
        itemId: String(item._id),
        pieceType: "bundle",
        mode: "unit",
        units: u,
        liters: round2(bundle.perBundleLiters ?? litersFromUnits(item, u)),
        fragility: f,
        allowMixing: true, // bundles can mix by default
        requiresVented: vent,
        minPackageKey: "Small",
      });
    }
    return out;
  }

  // Bags (default): split by kg cap based on fragility (density drives liters)
  if (mode === "kg") {
    const totalKg = Math.max(0, line.quantityKg ?? 0);
    const cap = MAX_KG_PER_BAG[f] ?? 2.0;
    const out: Piece[] = [];
    let rem = totalKg;
    while (rem > 0) {
      const bagKg = Math.min(rem, cap);
      out.push({
        itemId: String(item._id),
        pieceType: "bag",
        mode: "kg",
        qtyKg: round2(bagKg),
        liters: round2(litersFromKg(item, bagKg) + OVERHEAD_L_PER_BAG),
        fragility: f,
        allowMixing: mix,
        requiresVented: vent,
      });
      rem = round2(rem - bagKg);
    }
    return out;
  } else {
    // unit-mode → infer units per bag from kg cap (uses avgWeightPerUnit if present)
    const totalU = Math.max(0, Math.floor(line.units ?? 0));
    const perUnitKg = item.avgWeightPerUnitGr ? item.avgWeightPerUnitGr / 1000 : 0.15;
    const capKg = MAX_KG_PER_BAG[f] ?? 2.0;
    const maxUnits = Math.max(1, Math.floor(capKg / perUnitKg));
    const out: Piece[] = [];
    let rem = totalU;
    while (rem > 0) {
      const bagU = Math.min(rem, maxUnits);
      out.push({
        itemId: String(item._id),
        pieceType: "bag",
        mode: "unit",
        units: bagU,
        liters: round2(litersFromUnits(item, bagU) + OVERHEAD_L_PER_BAG),
        fragility: f,
        allowMixing: mix,
        requiresVented: vent,
      });
      rem -= bagU;
    }
    return out;
  }
}

function sortPiecesForPlacement(pieces: Piece[]): Piece[] {
  const rank = (f: Fragility) => (f === "sturdy" ? 3 : f === "normal" ? 2 : f === "fragile" ? 1 : 0);
  return [...pieces].sort((a, b) => {
    const rf = rank(a.fragility) - rank(b.fragility);
    if (rf !== 0) return -rf;       // sturdy first, fragile last (so fragile ends up on top)
    return b.liters - a.liters;     // bigger base first
  });
}

function pieceFitsLargest(piece: Piece, sizes: PackageSizeLite[]): boolean {
  const largest = [...sizes].sort((a,b)=> usableLiters(b)-usableLiters(a))[0];
  if (!largest) return false;
  const estKg = typeof piece.qtyKg === "number" ? piece.qtyKg : piece.liters * 0.5;
  return estKg <= largest.maxWeightKg && piece.liters <= usableLiters(largest);
}

function autoSplitIfNeeded(piece: Piece, sizes: PackageSizeLite[]): Piece[] {
  if (pieceFitsLargest(piece, sizes)) return [piece];
  // split in halves until it fits (guard)
  const out: Piece[] = [];
  const q: Piece[] = [piece];
  let guard = 0;
  while (q.length && guard < 8) {
    const cur = q.shift()!;
    if (pieceFitsLargest(cur, sizes)) { out.push(cur); continue; }
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

type OpenBox = { type: PackageSizeLite; contents: Piece[] };

function canPlaceIn(box: OpenBox, piece: Piece): boolean {
  if (piece.requiresVented && box.type.vented !== true) return false;
  if (piece.minPackageKey && String(box.type.key) < String(piece.minPackageKey)) return false;

  const curKg = box.contents.reduce((s,c)=> s + (typeof c.qtyKg==="number" ? c.qtyKg : c.liters*0.5), 0);
  const curL  = box.contents.reduce((s,c)=> s + c.liters, 0);
  const addKg = typeof piece.qtyKg === "number" ? piece.qtyKg : piece.liters * 0.5;
  const newKg = curKg + addKg;
  const newL  = curL + piece.liters;

  if (newKg > box.type.maxWeightKg) return false;
  if (newL > usableLiters(box.type)) return false;

  // minimal mixing rule: keep very_fragile alone by default
  if (piece.allowMixing === false) {
    const distinct = new Set(box.contents.map(c => c.itemId));
    if (distinct.size > 0 && (!distinct.has(piece.itemId) || distinct.size > 1)) return false;
  }

  // per-item kg cap inside a box (if used)
  if (piece.maxWeightPerPackageKg && piece.qtyKg) {
    const sameKg = box.contents
      .filter(c => c.itemId === piece.itemId)
      .reduce((s,c)=> s + (c.qtyKg ?? 0), 0);
    if (sameKg + piece.qtyKg > piece.maxWeightPerPackageKg) return false;
  }
  return true;
}

function smallestFeasibleBox(piece: Piece, sizes: PackageSizeLite[]): PackageSizeLite | undefined {
  const estKg = typeof piece.qtyKg === "number" ? piece.qtyKg : piece.liters * 0.5;
  const candidates = sizes
    .filter(s => !piece.requiresVented || s.vented === true)
    .filter(s => estKg <= s.maxWeightKg && piece.liters <= usableLiters(s))
    .sort((a,b)=> usableLiters(a) - usableLiters(b));
  if (piece.minPackageKey) {
    return candidates.find(s => String(s.key) >= String(piece.minPackageKey));
  }
  return candidates[0];
}

export function computePackingPlan(
  lines: OrderLineLite[],
  itemsById: Record<string, ItemLite>,
  packageSizes: PackageSizeLite[]
): PackingPlan {
  if (!Array.isArray(packageSizes) || packageSizes.length === 0) {
    return { boxes: [], summary: { totalBoxes: 0, byItem: [], warnings: ["No package sizes configured."] } };
  }

  // 1) lines → pieces (bags / bundles) + autosplit if needed
  let pieces: Piece[] = [];
  const warnings: string[] = [];
  for (const line of lines) {
    const item = itemsById[String(line.itemId)];
    if (!item) { warnings.push(`Item ${String(line.itemId)} not found; skipping.`); continue; }
    const built = buildPiecesForLine(line, item);
    for (const p of built) {
      const split = autoSplitIfNeeded(p, packageSizes);
      if (split.length > 1) warnings.push(`Auto-split piece of item ${p.itemId} to fit boxes.`);
      pieces.push(...split);
    }
  }

  // 2) order placement: sturdy → normal → fragile → very_fragile, then big → small
  pieces = sortPiecesForPlacement(pieces);

  // 3) assign to boxes
  const open: OpenBox[] = [];
  for (const piece of pieces) {
    let placed = false;

    for (const box of open) {
      if (canPlaceIn(box, piece)) { box.contents.push(piece); placed = true; break; }
    }
    if (placed) continue;

    const pick = smallestFeasibleBox(piece, packageSizes);
    if (pick) { open.push({ type: pick, contents: [piece] }); placed = true; }
    if (!placed) warnings.push(`Could not place a piece of item ${piece.itemId} (no feasible box).`);
  }

  // 4) format plan
  const boxes = open.map((b, i) => {
    const estL = round2(b.contents.reduce((s,c)=> s + c.liters, 0));
    const estKg = round2(b.contents.reduce((s,c)=> s + (typeof c.qtyKg==="number" ? c.qtyKg : c.liters*0.5), 0));
    const vol = usableLiters(b.type) || 1;
    return {
      boxNo: i + 1,
      boxType: String(b.type.key),
      vented: b.type.vented === true,
      estFillLiters: estL,
      estWeightKg: estKg,
      fillPct: clamp01(estL / vol),
      contents: b.contents.map(c => ({
        itemId: c.itemId,
        pieceType: c.pieceType,
        mode: c.mode,
        qtyKg: typeof c.qtyKg === "number" ? round2(c.qtyKg) : undefined,
        units: c.units,
        liters: round2(c.liters),
      })),
    };
  });

  // 5) summary
  const byItemMap = new Map<string, { itemId: string; bags: number; bundles: number; totalKg?: number; totalUnits?: number }>();
  for (const p of pieces) {
    const key = p.itemId;
    const cur = byItemMap.get(key) ?? { itemId: key, bags: 0, bundles: 0, totalKg: 0, totalUnits: 0 };
    if (p.pieceType === "bag") cur.bags += 1; else cur.bundles += 1;
    if (typeof p.qtyKg === "number") cur.totalKg = round2((cur.totalKg ?? 0) + p.qtyKg);
    if (typeof p.units === "number") cur.totalUnits = (cur.totalUnits ?? 0) + p.units;
    byItemMap.set(key, cur);
  }

  return { boxes, summary: { totalBoxes: boxes.length, byItem: [...byItemMap.values()], warnings } };
}

// convenience for order docs shaped as: { items: [{ itemId, quantity? | quantityKg? | units? }]}
export function computePackingForOrderDoc(
  order: { items: Array<{ itemId: string | ObjectId; quantity?: number; quantityKg?: number; units?: number }> },
  itemsById: Record<string, ItemLite>,
  packageSizes: PackageSizeLite[]
): PackingPlan {
  const lines: OrderLineLite[] = (order.items || []).map(it => ({
    itemId: it.itemId,
    quantityKg: typeof it.quantityKg === "number" ? it.quantityKg :
                 typeof it.quantity === "number" ? it.quantity : undefined,
    units: typeof it.units === "number" ? it.units : undefined,
  }));
  return computePackingPlan(lines, itemsById, packageSizes);
}

function round2(n:number){ return Math.round((n + Number.EPSILON) * 100) / 100; }
function clamp01(x:number){ return Math.max(0, Math.min(1, x)); }
