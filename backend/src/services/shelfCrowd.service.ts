/**
  * Minimal crowding service.
  * For dev: keeps counts in-memory (Map). In prod: swap to Redis.
  * score = activePickers*1.0 + activeSorters*0.7 + activeAudits*0.3 + liveContainers*0.5
  * crowded = score >= threshold (default 2.0)
*/
import Shelf from "../models/Shelf.model";

// This service maintains simple in-memory counters for crowding metrics on
// shelves.  Unlike the previous persisted implementation, no MongoDB
// collection is used.  Each shelfId has an associated Counters record
// tracking the number of active pick, sort and audit tasks.  Crowd
// score is computed on demand using the formula:
//   score = pick*1.0 + sort*0.7 + audit*0.3 + liveContainers*0.5
// where liveContainers is the current number of occupied slots on the shelf.

type Counters = { pick: number; sort: number; audit: number };

// In-memory store keyed by shelf id.  Values hold the current counts
// of active tasks for each type.  When a shelf is first bumped, its
// counters are initialised to zero.
const mem = new Map<string, Counters>();

function getC(shelfId: string): Counters {
  const cur = mem.get(shelfId);
  if (cur) return cur;
  const empty: Counters = { pick: 0, sort: 0, audit: 0 };
  mem.set(shelfId, empty);
  return empty;
}

export namespace CrowdService {
  /**
   * Adjust the active task counters for a shelf.  Positive delta
   * increments the specified counter; negative delta decrements.
   * Counters are clamped to zero on underflow.  The optional
   * userId is ignored in this in-memory implementation but kept for
   * API parity with the previous persisted version.
   */
  export async function bump(
    shelfId: string,
    delta: number,
    kind: "pick" | "sort" | "audit",
    _userId?: string
  ) {
    const c = getC(shelfId);
    // adjust the selected counter
    const current = c[kind] || 0;
    const next = current + delta;
    c[kind] = next < 0 ? 0 : next;
    return c;
  }

  /**
   * Compute the crowd status of a shelf.  This method calculates the
   * crowd score using in-memory counters and the current number of
   * live containers on the shelf (occupied slots).  It returns
   * whether the shelf is crowded along with the score and a breakdown
   * of contributing factors.
   */
  export async function computeShelfCrowd(shelfId: string, threshold = 2.0) {
    const counters = getC(shelfId);
    // fetch occupiedSlots for liveContainers count
    const shelf = await Shelf.findById(shelfId).select("occupiedSlots").lean();
    const liveContainers: number = shelf?.occupiedSlots ?? 0;
    const score =
      (counters.pick ?? 0) * 1.0 +
      (counters.sort ?? 0) * 0.7 +
      (counters.audit ?? 0) * 0.3 +
      liveContainers * 0.5;
    return {
      crowded: score >= threshold,
      score,
      breakdown: {
        pick: counters.pick ?? 0,
        sort: counters.sort ?? 0,
        audit: counters.audit ?? 0,
        liveContainers,
      },
      threshold,
    };
  }

  /**
   * List shelves with busy score below the threshold.  Iterates over
   * all shelfIds present in the in-memory counter map, computes the
   * crowd score for each and returns the shelves sorted by score
   * ascending.  Only shelves with crowd score strictly below the
   * threshold are returned.  Results are limited to the specified
   * maximum.
   */
  export async function getNonCrowded(limit = 10, threshold = 2.0) {
    const results: Array<any> = [];
    for (const [sid] of mem.entries()) {
      const crowd = await computeShelfCrowd(sid, threshold);
      if (crowd.score < threshold) {
        const shelf = await Shelf.findById(sid)
          .select("_id shelfId zone type occupiedSlots")
          .lean();
        if (!shelf) continue;
        results.push({
          ...shelf,
          crowd: { score: crowd.score, crowded: crowd.crowded },
        });
      }
    }
    // sort ascending by crowd score
    results.sort((a, b) => {
      const as = a.crowd?.score ?? 0;
      const bs = b.crowd?.score ?? 0;
      return as - bs;
    });
    return results.slice(0, limit);
  }
}
