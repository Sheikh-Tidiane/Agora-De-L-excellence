/**
 * Niveaux (table `Level`) : calcul pur, sans base. Le total de points est la somme du grand livre
 * (`PointTransaction`), corrections comprises ; un total négatif compte comme zéro.
 */
export type LevelRow = { code: string; name: string; minPoints: number };

export type LevelStanding = {
  /** Niveau atteint. `null` seulement si aucun niveau n'est défini. */
  current: LevelRow | null;
  /** Niveau suivant. `null` au dernier niveau. */
  next: LevelRow | null;
  /** Points qui manquent pour le suivant (0 au dernier niveau). */
  remaining: number;
  /** Avancée vers le suivant, de 0 à 1 (1 au dernier niveau). */
  progress: number;
};

export function levelStanding(levels: readonly LevelRow[], totalPoints: number): LevelStanding {
  const points = Math.max(0, Math.floor(totalPoints));
  const sorted = [...levels].sort((a, b) => a.minPoints - b.minPoints);
  let index = -1;
  for (const [i, level] of sorted.entries()) if (level.minPoints <= points) index = i;
  const current = index >= 0 ? sorted[index]! : null;
  const next = sorted[index + 1] ?? null;
  if (!next) return { current, next: null, remaining: 0, progress: current ? 1 : 0 };
  const from = current?.minPoints ?? 0;
  const span = next.minPoints - from;
  return {
    current,
    next,
    remaining: next.minPoints - points,
    progress: span > 0 ? Math.min(1, Math.max(0, (points - from) / span)) : 0,
  };
}
