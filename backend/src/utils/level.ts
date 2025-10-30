/**
 * Level formula per your spec:
 *   reqXP(L) = 200 + floor(60 * (L - 1)^1.35)
 */

function reqXP(L: number) {
  return 200 + Math.floor(60 * Math.pow(L - 1, 1.35));
}

export function levelFromXP(xp: number) {
  let L = 1;
  let spent = 0;
  let need = reqXP(1);

  while (xp >= spent + need) {
    spent += need;
    L++;
    need = reqXP(L);
  }
  return {
    level: L,
    xpIntoLevel: xp - spent,
    xpToNext: need - (xp - spent),
    reqThisLevel: need,
  };
}

/** Helper to recompute level on xp change */
export function recomputeLevel(xp: number): number {
  return levelFromXP(xp).level;
}
