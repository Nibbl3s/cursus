export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 5700, 7500,
];

export function getLevelFromXP(xp: number): number {
  return LEVEL_THRESHOLDS.findLastIndex((threshold) => xp >= threshold) + 1;
}

export function getXPToNextLevel(xp: number): { current: number; needed: number } {
  const level = getLevelFromXP(xp);
  const needed = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const current = xp - LEVEL_THRESHOLDS[level - 1];
  return { current, needed: needed - LEVEL_THRESHOLDS[level - 1] };
}
