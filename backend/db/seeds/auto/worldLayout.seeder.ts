// FILE: seeds/modules/worldLayout.seeder.ts
import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";
import mongoose, { Types } from "mongoose";
import WorldLayoutModel from "../../../src/models/WorldLayout.model";

// -------- Descriptor --------
const DATA = path.resolve(__dirname, "../data/worldLayouts.data.json");

const descriptor: SeederDescriptor = {
  name: "world-layout",
  collection: WorldLayoutModel.collection.name,
  dependsOn: [],           // none
  dataPaths: [DATA],
  upsertOn: ["logisticCenterId"], // unique per center
  hasStatic: true,
  hasFaker: false,
};

// -------- Helpers --------
function computePixelsPerMeter(
  zones: Array<{ width: number; height: number; grid: { rows: number; cols: number; showRowIndex?: boolean; showColIndex?: boolean } }>,
  minCellPx = { w: 70, h: 66 }
): number {
  const PAD = 16;
  const GAP = 8;
  const AXES_LEFT = 26;
  const AXES_TOP = 20;

  let requiredPPM = 1;
  for (const z of zones) {
    const { rows, cols, showRowIndex, showColIndex } = z.grid as any;
    const axL = showRowIndex ? AXES_LEFT : 0;
    const axT = showColIndex ? AXES_TOP : 0;

    const neededW = cols * minCellPx.w + GAP * (cols - 1) + PAD * 2 + axL + 6;
    const neededH = rows * minCellPx.h + GAP * (rows - 1) + PAD * 2 + (axT + 10);

    const ppmW = neededW / Math.max(1, z.width);
    const ppmH = neededH / Math.max(1, z.height);
    requiredPPM = Math.max(requiredPPM, ppmW, ppmH);
  }
  return Math.ceil(requiredPPM + 1);
}

function normalize(doc: any) {
  const out = { ...doc };

  // ensure ObjectId
  if (out.logisticCenterId && Types.ObjectId.isValid(out.logisticCenterId)) {
    out.logisticCenterId = new Types.ObjectId(String(out.logisticCenterId));
  } else {
    throw new Error(`world-layout: invalid logisticCenterId "${out.logisticCenterId}"`);
  }

  // ensure timestamps
  if (!out.createdAt) out.createdAt = new Date();
  out.updatedAt = new Date();

  // if pixelsPerMeter missing/invalid, compute
  if (!Number.isFinite(out.pixelsPerMeter)) {
    out.pixelsPerMeter = computePixelsPerMeter(out.zones || []);
  }

  return out;
}

// -------- Seeders --------
async function seedStatic(ctx: SeedContext) {
  let rows: any[] = await loadJSON(DATA, { strict: ctx.flags.strict });
  if (!Array.isArray(rows)) rows = [rows];

  const payload = rows.map(normalize);
  return bulkUpsertModel(WorldLayoutModel as any, payload, ["logisticCenterId"], ctx.batchSize, ctx.dryRun);
}


async function clear(ctx: SeedContext) {
  return clearModel(ctx, WorldLayoutModel as any);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
