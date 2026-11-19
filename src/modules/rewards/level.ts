/**
 * Level curve (Phase 15, owner decision; the same curve as the Jelajah
 * simulation since Phase 13): level L needs 50 × (L − 1) × L total XP.
 * L1 = 0, L2 = 100, L3 = 300, L4 = 600, ...
 */

/** Total XP needed to reach `level` (level < 1 counts as 1). */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return 50 * (l - 1) * l;
}

/** The level of a user with `xp` total XP (always >= 1). */
export function levelForXp(xp: number): number {
  if (!Number.isFinite(xp) || xp < xpForLevel(2)) {
    return 1;
  }
  // Closed form of 50(L-1)L <= xp, then corrected for float rounding.
  let level = Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2);
  while (xpForLevel(level + 1) <= xp) {
    level += 1;
  }
  while (level > 1 && xpForLevel(level) > xp) {
    level -= 1;
  }
  return level;
}
