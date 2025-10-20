/**
  * Minimal crowding service.
  * For dev: keeps counts in-memory (Map). In prod: swap to Redis.
  * score = activePickers*1.0 + activeSorters*0.7 + activeAudits*0.3 + liveContainers*0.5
  * crowded = score >= threshold (default 2.0)
*/
import Shelf from "../models/Shelf.model";
import { PersistedCrowdService } from "@/services/crowdPersistence.service";

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
    await PersistedCrowdService.bump(shelfId, delta, kind);
  }

  export async function computeShelfCrowd(shelfId: string, threshold = 2.0) {
    return PersistedCrowdService.computeShelfCrowd(shelfId, threshold);
  }

  /** List a few non-crowded shelves (basic scheduler helper). */
  export async function getNonCrowded(limit = 10) {
    return PersistedCrowdService.getNonCrowded(limit);
  }
}
