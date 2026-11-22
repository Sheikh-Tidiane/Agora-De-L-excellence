import { prisma, type Db } from "@/lib/prisma";
import {
  PUBLIC_STATUSES,
  publicPlayerName,
  type TournamentStatusCode,
} from "@/features/scrabble/rules";
import { loadTournamentSheet } from "@/features/scrabble/standings";

/**
 * Lectures publiques du Scrabble, sans dépendance à Next.js (testées contre la base ; `queries.ts`
 * les met en cache). Jamais de brouillon ni d'archivé ; classement visible seulement s'il est publié ;
 * noms : prénom + initiale (membre), « Membre de l’Agora » (retiré des classements), nom saisi (extérieur).
 */
const publicWhere = { status: { in: [...PUBLIC_STATUSES] }, archivedAt: null };
const playerSelect = {
  id: true,
  finalRank: true,
  withdrawnAt: true,
  externalName: true,
  externalClub: true,
  teamId: true,
  user: { select: { firstName: true, lastName: true, hiddenFromRankings: true } },
} as const;

export type PublicPlayer = { name: string; club: string | null; isExternal: boolean };

const toPlayer = (p: {
  externalName: string | null;
  externalClub: string | null;
  user: { firstName: string; lastName: string; hiddenFromRankings: boolean } | null;
}): PublicPlayer => ({
  name: publicPlayerName(p),
  club: p.user ? null : p.externalClub,
  isExternal: !p.user,
});

export type PublicTournamentSummary = {
  slug: string;
  name: string;
  status: TournamentStatusCode;
  format: "INDIVIDUAL" | "TEAMS";
  gameMode: "DUPLICATE" | "CLASSIC";
  isInterclub: boolean;
  location: string | null;
  startsAt: Date;
  endsAt: Date | null;
  participantCount: number;
  resultsPublishedAt: Date | null;
  /** Vainqueurs (rang 1) si les résultats sont publiés ; sinon vide. */
  winners: PublicPlayer[];
  /** Équipe(s) gagnante(s) en format « équipes ». */
  winningTeams: string[];
};

export async function readPublicTournaments(db: Db = prisma): Promise<PublicTournamentSummary[]> {
  const rows = await db.tournament.findMany({
    where: publicWhere,
    orderBy: { startsAt: "desc" },
    take: 200,
    select: {
      slug: true,
      name: true,
      status: true,
      format: true,
      gameMode: true,
      isInterclub: true,
      location: true,
      startsAt: true,
      endsAt: true,
      resultsPublishedAt: true,
      resultsValidatedAt: true,
      _count: { select: { participants: true } },
      teams: { select: { id: true, name: true } },
      participants: { where: { finalRank: 1 }, select: playerSelect },
    },
  });
  return rows.map(({ _count, teams, participants, resultsValidatedAt, ...row }) => {
    const visible = row.resultsPublishedAt !== null && resultsValidatedAt !== null;
    const winners = visible ? participants : [];
    const teamName = new Map(teams.map((t) => [t.id, t.name]));
    return {
      ...row,
      resultsPublishedAt: visible ? row.resultsPublishedAt : null,
      participantCount: _count.participants,
      winners: winners.filter((p) => !p.withdrawnAt).map(toPlayer),
      winningTeams:
        row.format === "TEAMS"
          ? [...new Set(winners.flatMap((p) => (p.teamId ? [teamName.get(p.teamId) ?? ""] : [])))]
          : [],
    };
  });
}

export type PublicStandingRow = PublicPlayer & {
  rank: number | null;
  team: string | null;
  withdrawn: boolean;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  forfeits: number;
  totalScore: number;
  spread: number;
};

export type PublicTeamRow = {
  rank: number | null;
  name: string;
  players: PublicPlayer[];
  wins: number;
  totalScore: number;
  spread: number;
};

export type PublicTournament = Omit<PublicTournamentSummary, "winners" | "winningTeams"> & {
  description: string | null;
  rules: string | null;
  rankingRule: "WINS_SCORE_SPREAD" | "CUMULATIVE_SCORE";
  /** `null` si vide : rien n'est affiché. */
  reward: string | null;
  event: { slug: string; title: string } | null;
  roundCount: number;
  /** Inscrits (sans résultat) tant que rien n'est publié. */
  players: PublicPlayer[];
  /** `null` tant que les résultats ne sont pas publiés. */
  results: { standings: PublicStandingRow[]; teams: PublicTeamRow[] } | null;
};

export async function readPublicTournament(
  slug: string,
  db: Db = prisma,
): Promise<PublicTournament | null> {
  const t = await db.tournament.findFirst({
    where: { slug, ...publicWhere },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      format: true,
      gameMode: true,
      rankingRule: true,
      isInterclub: true,
      location: true,
      startsAt: true,
      endsAt: true,
      description: true,
      rules: true,
      reward: true,
      resultsPublishedAt: true,
      resultsValidatedAt: true,
      event: { select: { slug: true, title: true, status: true, archivedAt: true } },
      _count: { select: { participants: true, rounds: true } },
    },
  });
  if (!t) return null;
  const isPublished = t.resultsPublishedAt !== null && t.resultsValidatedAt !== null;
  const eventVisible =
    t.event && !t.event.archivedAt && ["PUBLISHED", "CLOSED"].includes(t.event.status);
  const base = {
    slug: t.slug,
    name: t.name,
    status: t.status,
    format: t.format,
    gameMode: t.gameMode,
    rankingRule: t.rankingRule,
    isInterclub: t.isInterclub,
    location: t.location,
    startsAt: t.startsAt,
    endsAt: t.endsAt,
    description: t.description,
    rules: t.rules,
    reward: t.reward?.trim() ? t.reward : null,
    resultsPublishedAt: isPublished ? t.resultsPublishedAt : null,
    event: eventVisible ? { slug: t.event!.slug, title: t.event!.title } : null,
    participantCount: t._count.participants,
    roundCount: t._count.rounds,
  };
  if (!isPublished) {
    const players = await db.tournamentParticipant.findMany({
      where: { tournamentId: t.id, withdrawnAt: null },
      orderBy: { createdAt: "asc" },
      select: playerSelect,
    });
    return { ...base, players: players.map(toPlayer), results: null };
  }
  const sheet = await loadTournamentSheet(db, t);
  const byId = new Map(sheet.participants.map((p) => [p.id, p]));
  const teamName = new Map(sheet.teams.map((team) => [team.id, team.name]));
  const teams = t.format === "TEAMS";
  const standings = sheet.ranking.standings.map((s) => {
    const p = byId.get(s.participantId)!;
    return {
      ...toPlayer(p),
      // Individuel : le rang figé à la validation. Équipes : le rang individuel calculé.
      rank: teams ? s.rank : p.finalRank,
      team: p.teamId ? (teamName.get(p.teamId) ?? null) : null,
      withdrawn: s.withdrawn,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      forfeits: s.forfeits,
      totalScore: s.totalScore,
      spread: s.spread,
    };
  });
  const teamRows = sheet.ranking.teams.map((team) => ({
    rank: team.rank,
    name: teamName.get(team.teamId) ?? "",
    players: team.participantIds.map((id) => toPlayer(byId.get(id)!)),
    wins: team.wins,
    totalScore: team.totalScore,
    spread: team.spread,
  }));
  return { ...base, players: [], results: { standings, teams: teamRows } };
}

export type PalmaresEntry = {
  slug: string;
  name: string;
  startsAt: Date;
  format: "INDIVIDUAL" | "TEAMS";
  isInterclub: boolean;
  winners: PublicPlayer[];
  winningTeams: string[];
};

/** Palmarès : vainqueurs des tournois aux résultats publiés, le plus récent d'abord. */
export async function readPalmares(db: Db = prisma): Promise<PalmaresEntry[]> {
  const rows = (await readPublicTournaments(db)).filter((t) => t.resultsPublishedAt !== null);
  return rows
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .map(({ slug, name, startsAt, format, isInterclub, winners, winningTeams }) => ({
      slug,
      name,
      startsAt,
      format,
      isInterclub,
      winners,
      winningTeams,
    }));
}

export type PublicRecord = {
  id: string;
  category: string;
  value: string;
  holder: string;
  achievedAt: Date | null;
  /** Tournoi public où le record a été établi, s'il y en a un. */
  tournament: { slug: string; name: string } | null;
};

/** Records en cours (non battus). Liste vide : la page n'affiche rien. */
export async function readCurrentRecords(db: Db = prisma): Promise<PublicRecord[]> {
  const rows = await db.scrabbleRecord.findMany({
    where: { supersededAt: null },
    orderBy: [{ position: "asc" }, { category: "asc" }],
    select: {
      id: true,
      category: true,
      value: true,
      holderName: true,
      achievedAt: true,
      user: { select: { firstName: true, lastName: true, hiddenFromRankings: true } },
      tournament: { select: { slug: true, name: true, status: true, archivedAt: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    value: r.value,
    holder: publicPlayerName({ user: r.user, externalName: r.holderName, externalClub: null }),
    achievedAt: r.achievedAt,
    tournament:
      r.tournament && !r.tournament.archivedAt && PUBLIC_STATUSES.includes(r.tournament.status)
        ? { slug: r.tournament.slug, name: r.tournament.name }
        : null,
  }));
}
