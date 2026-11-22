import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cacheTags, publicCacheLife } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import {
  readCurrentRecords,
  readPalmares,
  readPublicTournament,
  readPublicTournaments,
  type PalmaresEntry,
  type PublicRecord,
  type PublicTournament,
  type PublicTournamentSummary,
} from "@/features/scrabble/public-read";
import {
  getMonthlyScrabbleRanking as monthly,
  type MonthlyScrabbleRanking,
} from "@/features/scrabble/monthly-ranking";
import {
  readAdminRecords,
  readAdminTournament,
  readAdminTournaments,
  readLinkableEvents,
  readMemberTournamentHistory,
  searchMembersForTournament,
  type AdminTournament,
  type AdminTournamentRow,
  type MemberTournamentEntry,
} from "@/features/scrabble/admin-read";

/**
 * Lectures du Scrabble pour l'interface. Les lectures publiques sont mises en cache sous
 * `cacheTags.scrabble` (chaque action qui change un tournoi ou un record l'invalide).
 * Les lectures de l'administration et de l'espace membre ne sont pas en cache : la page appelante
 * vérifie l'accès (`requirePageAccess` / session) avant de les appeler.
 */
export type {
  AdminParticipant,
  AdminTournament,
  AdminTournamentRow,
  MemberTournamentEntry,
} from "@/features/scrabble/admin-read";
export type {
  PalmaresEntry,
  PublicPlayer,
  PublicRecord,
  PublicStandingRow,
  PublicTeamRow,
  PublicTournament,
  PublicTournamentSummary,
} from "@/features/scrabble/public-read";
export type { MonthlyRow, MonthlyScrabbleRanking } from "@/features/scrabble/monthly-ranking";

// --- Public (en cache) ---

export async function getPublicTournaments(): Promise<PublicTournamentSummary[]> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.scrabble);
  return readPublicTournaments(prisma);
}

export async function getPublicTournament(slug: string): Promise<PublicTournament | null> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.scrabble);
  return readPublicTournament(slug, prisma);
}

export async function getPalmares(): Promise<PalmaresEntry[]> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.scrabble);
  return readPalmares(prisma);
}

export async function getCurrentRecords(): Promise<PublicRecord[]> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.scrabble);
  return readCurrentRecords(prisma);
}

// --- Membre (sans cache : dépend du visiteur) ---

export async function getMonthlyScrabbleRanking(input: {
  viewerId: string | null;
  now?: Date;
}): Promise<MonthlyScrabbleRanking> {
  return monthly({ viewerId: input.viewerId, now: input.now ?? new Date() }, prisma);
}

export async function getMemberTournamentHistory(userId: string): Promise<MemberTournamentEntry[]> {
  return readMemberTournamentHistory(userId, prisma);
}

// --- Administration (sans cache) ---

export async function getAdminTournaments(): Promise<AdminTournamentRow[]> {
  return readAdminTournaments(prisma);
}

export async function getAdminTournament(id: string): Promise<AdminTournament | null> {
  return readAdminTournament(id, prisma);
}

export async function findMembersForTournament(tournamentId: string, q: string) {
  return searchMembersForTournament(tournamentId, q, prisma);
}

export async function getLinkableEvents(tournamentId: string | null) {
  return readLinkableEvents(tournamentId, prisma);
}

export async function getAdminRecords() {
  return readAdminRecords(prisma);
}
