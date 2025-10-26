// FILE: src/services/worldLayout.service.ts
import { Types } from "mongoose";
import ApiError from "../utils/ApiError";
import WorldLayoutModel from "../models/WorldLayout.model";

/**
 * Same logic as your frontend helper, but on the server.
 * Ensures each zone can render with >= min cell size.
 */
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
    const { rows, cols, showRowIndex, showColIndex } = z.grid;
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

/** Default server-side layout (was your old ZONES_METERS). */
const DEFAULT_ZONES = [
  {
    id: "A",
    x: 0, y: 0, width: 55, height: 12,
    grid: { rows: 3, cols: 18, showRowIndex: true, showColIndex: true, colLabels: "numbers", titleSize: 30 }
  },
  {
    id: "B",
    x: 0, y: 12, width: 18, height: 20,
    grid: { rows: 4, cols: 3, showRowIndex: true, showColIndex: true, colLabels: "numbers", titleSize: 28 }
  },
  {
    id: "C",
    x: 23, y: 12, width: 25, height: 20,
    grid: { rows: 4, cols: 9, showRowIndex: true, showColIndex: true, colLabels: "numbers", titleSize: 28 }
  },
];

export namespace WorldLayoutService {
  /**
   * Get existing layout by center or create one with defaults.
   * Allows clients to request minCellPx sizing via query.
   */
 export async function getOrCreateByCenter(args: {
    centerId: string;
    minCellW?: number;
    minCellH?: number;
  }) {
    const { centerId, minCellW = 70, minCellH = 66 } = args;
    if (!Types.ObjectId.isValid(centerId)) throw new ApiError(400, "Invalid centerId");

    // Work with a Document first (no `.lean()` here)
    let doc = await WorldLayoutModel.findOne({ logisticCenterId: centerId });

    if (!doc) {
      const ppm = computePixelsPerMeter(DEFAULT_ZONES as any, { w: minCellW, h: minCellH });
      doc = await WorldLayoutModel.create({
        logisticCenterId: new Types.ObjectId(centerId),
        pixelsPerMeter: ppm,
        zones: DEFAULT_ZONES,
      });
      // Return POJO
      return doc.toObject();
    }

    // Existing doc: recompute PPM on the fly (don’t persist unless you want to)
    const base = doc.toObject();
    const ppm = computePixelsPerMeter(base.zones as any, { w: minCellW, h: minCellH });
    if (ppm !== base.pixelsPerMeter) {
      base.pixelsPerMeter = ppm;
    }
    return base;
  }
}
