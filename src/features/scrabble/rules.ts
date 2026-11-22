/**
 * Règles pures du Scrabble (sans base) : cycle de vie d'un tournoi, noms affichés, points du
 * classement mensuel. Détail : docs/DECISIONS.md, section 13.
 */
import { lastNameInitial } from "@/features/gamification/rules";

export type TournamentStatusCode =
  "DRAFT" | "REGISTRATION_OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

/**
 * Transitions permises. Un tournoi annulé peut revenir en brouillon (réversible) ; un tournoi
 * terminé peut être rouvert tant que ses résultats ne sont pas validés (vérifié par le service).
 */
const transitions: Record<TournamentStatusCode, readonly TournamentStatusCode[]> = {
  DRAFT: ["REGISTRATION_OPEN", "IN_PROGRESS", "CANCELLED"],
  REGISTRATION_OPEN: ["DRAFT", "IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["REGISTRATION_OPEN", "COMPLETED", "CANCELLED"],
  COMPLETED: ["IN_PROGRESS"],
  CANCELLED: ["DRAFT"],
};

export function canTransition(from: TournamentStatusCode, to: TournamentStatusCode): boolean {
  return transitions[from].includes(to);
}

export const statusLabels: Record<TournamentStatusCode, string> = {
  DRAFT: "Brouillon",
  REGISTRATION_OPEN: "Inscriptions ouvertes",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
};

/** Statuts où l'on peut encore inscrire ou retirer des joueurs. */
export const ROSTER_STATUSES: readonly TournamentStatusCode[] = [
  "DRAFT",
  "REGISTRATION_OPEN",
  "IN_PROGRESS",
];

/** Statuts où l'on saisit les scores (et prépare manches et parties). */
export const PLAY_STATUSES: readonly TournamentStatusCode[] = [
  "REGISTRATION_OPEN",
  "IN_PROGRESS",
  "COMPLETED",
];

/** Statuts visibles du public (jamais un brouillon ; l'archivé est filtré à part). */
export const PUBLIC_STATUSES: readonly TournamentStatusCode[] = [
  "REGISTRATION_OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

/**
 * Adresse publique d'un tournoi (lien des notifications de résultats). La page est construite par
 * l'interface : garder cette fonction alignée sur la route réelle.
 */
export const tournamentPublicPath = (slug: string) => `/scrabble/${slug}`;

/** « à la 1re place », « à la 2e place »… */
export function placeLabel(rank: number): string {
  return `à la ${rank}${rank === 1 ? "re" : "e"} place`;
}

/** Libellé affiché d'un membre retiré des classements. */
export const HIDDEN_MEMBER_LABEL = "Membre de l’Agora";

export type PlayerIdentity = {
  user: { firstName: string; lastName: string; hiddenFromRankings: boolean } | null;
  externalName: string | null;
  externalClub: string | null;
};

/**
 * Nom public d'un joueur : prénom + initiale pour un membre, « Membre de l’Agora » s'il s'est
 * retiré des classements, nom saisi pour un participant extérieur (son club à part).
 * Les mineurs sont traités comme les autres membres : prénom + initiale seulement.
 */
export function publicPlayerName(player: PlayerIdentity): string {
  if (player.user) {
    if (player.user.hiddenFromRankings) return HIDDEN_MEMBER_LABEL;
    return `${player.user.firstName} ${lastNameInitial(player.user.lastName)}`.trim();
  }
  return player.externalName ?? "Participant";
}

/** Nom complet, pour l'administration seulement. */
export function adminPlayerName(player: PlayerIdentity): string {
  if (player.user) return `${player.user.firstName} ${player.user.lastName}`.trim();
  return player.externalName ?? "Participant";
}

/**
 * Points du classement mensuel pour une place : `classés − rang + 1` (le 1er d'un tournoi de
 * 8 joueurs classés reçoit 8, le dernier 1 ; ex æquo : mêmes points). `classés` compte les
 * joueurs (ou les équipes) classés, participants extérieurs compris.
 */
export function placementPoints(rank: number | null, rankedCount: number): number {
  if (rank === null || rank < 1 || rank > rankedCount) return 0;
  return rankedCount - rank + 1;
}

/** Saisie attendue d'une manche : un score par joueur non retiré (duplicate) ou par joueur d'une partie (classique). */
export function expectedEntries(input: {
  classic: boolean;
  activeParticipantIds: readonly string[];
  matches: readonly { participantAId: string; participantBId: string }[];
  scoredParticipantIds: readonly string[];
}): { expected: number; entered: number; missing: string[] } {
  const scored = new Set(input.scoredParticipantIds);
  const expected = input.classic
    ? input.matches.flatMap((m) => [m.participantAId, m.participantBId])
    : [...new Set([...input.activeParticipantIds, ...input.scoredParticipantIds])];
  const missing = expected.filter((id) => !scored.has(id));
  return { expected: expected.length, entered: expected.length - missing.length, missing };
}
