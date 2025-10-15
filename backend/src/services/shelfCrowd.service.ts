/**
 * Minimal crowding service.
 * For dev: keeps counts in-memory (Map). In prod: swap to Redis.
 * score = activePickers*1.0 + activeSorters*0.7 + activeAudits*0.3 + liveContainers*0.5
 * crowded = score >= threshold (default 2.0)
 */
import Shelf from "../models/Shelf.model";

type Counters = { pick: number; sort: number; audit: number };
const mem = new Map<string, Counters>();

function getC(shelfId: string): Counters {
  const cur = mem.get(shelfId);
  if (cur) return cur;
  const empty = { pick: 0, sort: 0, audit: 0 };
  mem.set(shelfId, empty);
  return empty;
}

export namespace CrowdService {
  export async function bump(shelfId: string, delta: number, kind: "pick" | "sort" | "audit", _userId?: string) {
    const c = getC(shelfId);
    c[kind] = Math.max(0, (c[kind] ?? 0) + delta);
    mem.set(shelfId, c);
  }

  export async function computeShelfCrowd(shelfId: string, threshold = 2.0) {
    const shelf = await Shelf.findById(shelfId).select("occupiedSlots").lean();
    const c = getC(shelfId);
    const liveContainers = shelf?.occupiedSlots ?? 0;

    const score = (c.pick ?? 0) * 1.0 + (c.sort ?? 0) * 0.7 + (c.audit ?? 0) * 0.3 + liveContainers * 0.5;
    return {
      crowded: score >= threshold,
      score,
      breakdown: { ...c, liveContainers },
      threshold,
    };
  }

  /** List a few non-crowded shelves (basic scheduler helper). */
  export async function getNonCrowded(limit = 10) {
    const shelves = await Shelf.find({}).select("_id shelfId zone type occupiedSlots").limit(100).lean();
    const withScores = await Promise.all(
      shelves.map(async (s) => {
        const c = await computeShelfCrowd(String(s._id));
        return { ...s, crowd: c };
      })
    );
    return withScores.filter((x) => !x.crowd.crowded).slice(0, limit);
  }
}
