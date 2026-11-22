/**
 * Classement d'un tournoi de Scrabble : calcul PUR, sans base ni React (testé dans `ranking.test.ts`).
 * Règles (docs/REGLES-METIER.md, « Scrabble », et docs/DECISIONS.md, section 13) :
 * - `WINS_SCORE_SPREAD` : victoires, puis cumul des scores, puis différentiel ;
 * - `CUMULATIVE_SCORE` (duplicate) : cumul des scores ;
 * - forfait = défaite, score 0 ; l'adversaire présent gagne ; double forfait = deux défaites ;
 * - partie nulle au classique (scores égaux, sans forfait) : une demi-victoire chacun ;
 * - égalité parfaite sur tous les critères de la règle : même rang partagé (1, 1, 3) ;
 * - un joueur qui n'a joué aucune manche n'est pas classé (`rank: null`) ;
 * - un joueur retiré garde ses manches jouées, signalé, classé après tous les joueurs non retirés ;
 * - équipes : chaque équipe additionne victoires, scores et différentiel de ses joueurs, puis est
 *   classée selon la même règle ; une équipe dont aucun joueur n'a joué n'est pas classée.
 */
export type RankingRuleCode = "WINS_SCORE_SPREAD" | "CUMULATIVE_SCORE";

export type RankingParticipant = {
  id: string;
  teamId: string | null;
  withdrawn: boolean;
  /** Clé d'affichage à égalité (nom), pour un ordre stable ; l'identifiant départage ensuite. */
  sortKey?: string;
};

export type RankingScore = {
  roundId: string;
  participantId: string;
  points: number;
  isForfeit: boolean;
};

export type RankingMatch = {
  id: string;
  roundId: string;
  participantAId: string;
  participantBId: string;
};

export type RankingInput = {
  rule: RankingRuleCode;
  participants: readonly RankingParticipant[];
  scores: readonly RankingScore[];
  /** Parties du mode classique. En duplicate : aucune. */
  matches: readonly RankingMatch[];
  /** Mode classique : un score sans partie (joueur exempté) ne compte pas. */
  classic: boolean;
};

export type Stats = {
  /** Manches jouées (un score saisi, forfait compris). */
  played: number;
  /** Victoires ; une partie nulle compte 0,5. */
  wins: number;
  losses: number;
  draws: number;
  forfeits: number;
  totalScore: number;
  /** Différentiel : somme (son score − score de l'adversaire) sur les parties terminées. */
  spread: number;
};

export type Standing = Stats & {
  participantId: string;
  teamId: string | null;
  withdrawn: boolean;
  /** `null` : aucune manche jouée, non classé. */
  rank: number | null;
};

export type TeamStanding = Stats & {
  teamId: string;
  participantIds: string[];
  rank: number | null;
};

export type RankingResult = {
  standings: Standing[];
  /** Classement des équipes ; vide hors format « équipes ». */
  teams: TeamStanding[];
  /** Parties dont un seul des deux scores est saisi : non comptées. */
  incompleteMatches: string[];
};

const emptyStats = (): Stats => ({
  played: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  forfeits: 0,
  totalScore: 0,
  spread: 0,
});

const key = (roundId: string, participantId: string) => `${roundId}:${participantId}`;

/** Compare deux bilans selon la règle : négatif si `a` passe devant `b`, 0 en cas d'égalité parfaite. */
export function compareStats(rule: RankingRuleCode, a: Stats, b: Stats): number {
  if (rule === "CUMULATIVE_SCORE") return b.totalScore - a.totalScore;
  return b.wins - a.wins || b.totalScore - a.totalScore || b.spread - a.spread;
}

/** Applique le résultat d'une partie aux deux bilans. */
function applyMatch(a: Stats, b: Stats, sa: RankingScore, sb: RankingScore): void {
  const pa = sa.isForfeit ? 0 : sa.points;
  const pb = sb.isForfeit ? 0 : sb.points;
  if (sa.isForfeit) a.forfeits += 1;
  if (sb.isForfeit) b.forfeits += 1;
  if (sa.isForfeit || sb.isForfeit) {
    // Forfait : défaite du (des) absent(s) ; le joueur présent gagne.
    if (sa.isForfeit) a.losses += 1;
    else a.wins += 1;
    if (sb.isForfeit) b.losses += 1;
    else b.wins += 1;
  } else if (pa > pb) {
    a.wins += 1;
    b.losses += 1;
  } else if (pb > pa) {
    b.wins += 1;
    a.losses += 1;
  } else {
    a.wins += 0.5;
    b.wins += 0.5;
    a.draws += 1;
    b.draws += 1;
  }
  a.spread += pa - pb;
  b.spread += pb - pa;
}

/** Bilans individuels à partir des scores (et des parties en mode classique). */
function computeStats(input: RankingInput): {
  stats: Map<string, Stats>;
  incompleteMatches: string[];
} {
  const stats = new Map(input.participants.map((p) => [p.id, emptyStats()]));
  const byKey = new Map(input.scores.map((s) => [key(s.roundId, s.participantId), s]));
  const incompleteMatches: string[] = [];
  const counted = new Set<string>();

  const addScore = (score: RankingScore) => {
    const own = stats.get(score.participantId);
    if (!own) return;
    own.played += 1;
    own.totalScore += score.isForfeit ? 0 : score.points;
    counted.add(key(score.roundId, score.participantId));
  };

  if (input.classic) {
    for (const match of input.matches) {
      const sa = byKey.get(key(match.roundId, match.participantAId));
      const sb = byKey.get(key(match.roundId, match.participantBId));
      const a = stats.get(match.participantAId);
      const b = stats.get(match.participantBId);
      if (!a || !b) continue;
      if (!sa || !sb) {
        if (sa || sb) incompleteMatches.push(match.id);
        continue;
      }
      addScore(sa);
      addScore(sb);
      applyMatch(a, b, sa, sb);
    }
  } else {
    for (const score of input.scores) {
      // Duplicate : chaque score compte ; un forfait est aussi une défaite.
      if (counted.has(key(score.roundId, score.participantId))) continue;
      addScore(score);
      const own = stats.get(score.participantId);
      if (own && score.isForfeit) {
        own.forfeits += 1;
        own.losses += 1;
      }
    }
  }
  return { stats, incompleteMatches };
}

type Rankable = Stats & { id: string; sortKey: string; group: number };

/**
 * Rangs « 1, 1, 3 » dans l'ordre : groupe (0 = classé, 1 = retiré), puis la règle ;
 * à égalité parfaite, même rang. Les non-classés (aucune manche) reçoivent `null`.
 */
function assignRanks(rule: RankingRuleCode, rows: Rankable[]): Map<string, number | null> {
  const ranks = new Map<string, number | null>();
  const sorted = rows
    .filter((row) => row.played > 0)
    .sort(
      (a, b) =>
        a.group - b.group ||
        compareStats(rule, a, b) ||
        a.sortKey.localeCompare(b.sortKey, "fr") ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  sorted.forEach((row, index) => {
    const previous = sorted[index - 1];
    const tied =
      previous && previous.group === row.group && compareStats(rule, previous, row) === 0;
    ranks.set(row.id, tied ? (ranks.get(previous.id) ?? index + 1) : index + 1);
  });
  for (const row of rows) if (!ranks.has(row.id)) ranks.set(row.id, null);
  return ranks;
}

const byRank = <T extends { rank: number | null }>(a: T, b: T) =>
  (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER);

export function computeRanking(input: RankingInput, options: { teams: boolean }): RankingResult {
  const { stats, incompleteMatches } = computeStats(input);
  const rows: Rankable[] = input.participants.map((p) => ({
    ...stats.get(p.id)!,
    id: p.id,
    sortKey: p.sortKey ?? "",
    group: p.withdrawn ? 1 : 0,
  }));
  const ranks = assignRanks(input.rule, rows);
  // À rang égal (ou non classés) : ordre du nom, puis de l'identifiant, jamais celui de la base.
  const sortKeys = [...rows].sort(
    (a, b) => a.sortKey.localeCompare(b.sortKey, "fr") || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const order = new Map(sortKeys.map((row, index) => [row.id, index]));
  const standings: Standing[] = input.participants
    .map((p) => ({
      ...stats.get(p.id)!,
      participantId: p.id,
      teamId: p.teamId,
      withdrawn: p.withdrawn,
      rank: ranks.get(p.id) ?? null,
    }))
    .sort((a, b) => byRank(a, b) || order.get(a.participantId)! - order.get(b.participantId)!);

  const teams: TeamStanding[] = [];
  if (options.teams) {
    const groups = new Map<string, TeamStanding>();
    for (const p of input.participants) {
      if (!p.teamId) continue;
      const team = groups.get(p.teamId) ?? {
        ...emptyStats(),
        teamId: p.teamId,
        participantIds: [],
        rank: null,
      };
      const own = stats.get(p.id)!;
      for (const field of Object.keys(own) as (keyof Stats)[]) team[field] += own[field];
      team.participantIds.push(p.id);
      groups.set(p.teamId, team);
    }
    const list = [...groups.values()];
    const teamRanks = assignRanks(
      input.rule,
      list.map((team) => ({ ...team, id: team.teamId, sortKey: "", group: 0 })),
    );
    for (const team of list) team.rank = teamRanks.get(team.teamId) ?? null;
    teams.push(...list.sort((a, b) => byRank(a, b) || (a.teamId < b.teamId ? -1 : 1)));
  }
  return { standings, teams, incompleteMatches };
}

/** Vainqueurs : participants de rang 1 (individuel) ou joueurs non retirés des équipes de rang 1. */
export function winnersOf(result: RankingResult, options: { teams: boolean }): string[] {
  if (!options.teams) {
    return result.standings.filter((s) => s.rank === 1 && !s.withdrawn).map((s) => s.participantId);
  }
  const withdrawn = new Set(
    result.standings.filter((s) => s.withdrawn).map((s) => s.participantId),
  );
  return result.teams
    .filter((team) => team.rank === 1)
    .flatMap((team) => team.participantIds.filter((id) => !withdrawn.has(id)));
}
