// FILE: src/services/crowdPersistence.service.ts
//
// Persisted crowd management.  This service replaces the in-memory
// implementation in shelfCrowd.service.ts.  It stores per-shelf
// counters in the CrowdState collection and computes busy scores
// whenever counts change.  The busy score uses the formula:
//   score = pickCount*1.0 + sortCount*0.7 + auditCount*0.3 + liveContainers*0.5
// A shelf is considered crowded when score >= threshold (default 2.0).

import { Types } from "mongoose";
import CrowdState from "@/models/CrowdState.model.ts";
import Shelf from "@/models/Shelf.model";

export namespace PersistedCrowdService {
  /**
   * Bump counters for a shelf by delta.  This method increments the
   * appropriate counter (pick, sort or audit) and recomputes the busy
   * score based on the updated counts and current number of live
   * containers on the shelf.  The result is saved in the CrowdState
   * document.
   */
  export async function bump(
    shelfId: string,
    delta: number,
    kind: "pick" | "sort" | "audit"
  ) {
    const id = new Types.ObjectId(shelfId);
    const inc: any = {};
    inc[`${kind}Count`] = delta;
    const state = await CrowdState.findOneAndUpdate(
      { shelfId: id },
      { $inc: inc, $set: { updatedAt: new Date() } },
      { new: true, upsert: true }
    );
    // fetch occupied slots for liveContainers count
    const shelf = await Shelf.findById(id).select("occupiedSlots").lean();
    const liveContainers = shelf?.occupiedSlots ?? 0;
    const busyScore =
      (state.pickCount ?? 0) * 1.0 +
      (state.sortCount ?? 0) * 0.7 +
      (state.auditCount ?? 0) * 0.3 +
      liveContainers * 0.5;
    state.busyScore = busyScore;
    await state.save();
    return state;
  }

  /**
   * Compute the crowd status of a shelf.  Returns whether the shelf is
   * crowded (score >= threshold) along with the score and breakdown.
   */
  export async function computeShelfCrowd(shelfId: string, threshold = 2.0) {
    const id = new Types.ObjectId(shelfId);
    let state = await CrowdState.findOne({ shelfId: id });
    if (!state) {
      // ensure at least default state exists
      state = await CrowdState.create({ shelfId: id });
    }
    const shelf = await Shelf.findById(id).select("occupiedSlots").lean();
    const liveContainers = shelf?.occupiedSlots ?? 0;
    const score =
      (state.pickCount ?? 0) * 1.0 +
      (state.sortCount ?? 0) * 0.7 +
      (state.auditCount ?? 0) * 0.3 +
      liveContainers * 0.5;
    return {
      crowded: score >= threshold,
      score,
      breakdown: {
        pick: state.pickCount ?? 0,
        sort: state.sortCount ?? 0,
        audit: state.auditCount ?? 0,
        liveContainers,
      },
      threshold,
    };
  }

  /**
   * List shelves with busy score below the threshold.  This method
   * returns shelves sorted by busyScore ascending to help select
   * non-crowded shelves for placement or picking.
   */
  export async function getNonCrowded(limit = 10, threshold = 2.0) {
    // join shelves and crowd states
    const states = await CrowdState.find({ busyScore: { $lt: threshold } })
      .sort({ busyScore: 1 })
      .limit(limit)
      .lean();
    const result = await Promise.all(
      states.map(async (cs) => {
        const shelf = await Shelf.findById(cs.shelfId)
          .select("_id shelfId zone type occupiedSlots")
          .lean();
        return {
          ...shelf,
          crowd: { score: cs.busyScore, crowded: cs.busyScore >= threshold },
        };
      })
    );
    return result;
  }
}
