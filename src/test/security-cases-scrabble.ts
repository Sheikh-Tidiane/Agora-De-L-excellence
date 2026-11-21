import * as scrabble from "@/features/scrabble/actions";
import type { ActionResult } from "@/lib/errors";
import type { PermissionCode } from "@/lib/permissions/catalog";

/**
 * Server Actions du Scrabble pour la matrice de sécurité (src/features/actions-security.test.ts et
 * actions-validation.test.ts). Même forme que `ProtectedCase` dans security-cases.ts.
 */
type Case = {
  key: string;
  run: (input: unknown) => Promise<ActionResult<unknown>>;
  allow: readonly PermissionCode[];
  valid: Record<string, unknown>;
  invalid: Record<string, unknown>;
};

const ID = "ckx1a2b3c4d5e6f7g8h9i0j1k";
const LONG_ID = "x".repeat(41);
const file = "src/features/scrabble/actions.ts";

function c<I>(
  name: keyof typeof scrabble,
  run: (input: I) => Promise<ActionResult<unknown>>,
  allow: readonly PermissionCode[],
  valid: Record<string, unknown>,
  invalid: Record<string, unknown>,
): Case {
  return { key: `${file}#${name}`, run: (input) => run(input as I), allow, valid, invalid };
}

const badIds = (field: string, base: object = {}) => ({
  [`${field} vide`]: { ...base, [field]: "" },
  [`${field} : objet`]: { ...base, [field]: { not: "" } },
  [`${field} trop long`]: { ...base, [field]: LONG_ID },
  [`${field} manquant`]: { ...base, [field]: undefined },
});

const manage = ["tournaments.manage"] as const;
const publish = ["results.publish"] as const;

export const tournamentValid = {
  name: "Tournoi de Scrabble de mars",
  description: "",
  rules: "",
  format: "INDIVIDUAL",
  gameMode: "DUPLICATE",
  rankingRule: "CUMULATIVE_SCORE",
  isInterclub: false,
  countsForMonthly: true,
  location: "",
  reward: "",
  startsAt: "2027-03-06T16:00",
  endsAt: null,
  eventId: null,
};

const recordValid = {
  category: "Meilleur score sur une partie",
  value: "512 points",
  userId: null,
  holderName: "Moussa Ndiaye",
};

export const scrabbleCases: Case[] = [
  c("createTournamentAction", scrabble.createTournamentAction, manage, tournamentValid, {
    "nom trop court": { ...tournamentValid, name: "ab" },
    "format inconnu": { ...tournamentValid, format: "SOLO" },
    "date illisible": { ...tournamentValid, startsAt: "demain" },
    "récompense géante": { ...tournamentValid, reward: "x".repeat(301) },
    "monthly : chaîne": { ...tournamentValid, countsForMonthly: "true" },
  }),
  c(
    "updateTournamentAction",
    scrabble.updateTournamentAction,
    manage,
    { ...tournamentValid, id: ID },
    {
      ...badIds("id", tournamentValid),
    },
  ),
  c(
    "setTournamentStatusAction",
    scrabble.setTournamentStatusAction,
    manage,
    { tournamentId: ID, status: "IN_PROGRESS" },
    {
      ...badIds("tournamentId", { status: "IN_PROGRESS" }),
      "statut inconnu": { tournamentId: ID, status: "PUBLISHED" },
    },
  ),
  c(
    "archiveTournamentAction",
    scrabble.archiveTournamentAction,
    manage,
    { tournamentId: ID },
    badIds("tournamentId"),
  ),
  c(
    "addParticipantAction",
    scrabble.addParticipantAction,
    manage,
    { tournamentId: ID, userId: ID },
    {
      ...badIds("tournamentId", { userId: ID }),
      "ni membre ni extérieur": { tournamentId: ID },
      "membre et extérieur à la fois": { tournamentId: ID, userId: ID, externalName: "Moussa" },
      "nom extérieur géant": { tournamentId: ID, externalName: "x".repeat(81) },
    },
  ),
  c(
    "removeParticipantAction",
    scrabble.removeParticipantAction,
    manage,
    { participantId: ID },
    badIds("participantId"),
  ),
  c(
    "setParticipantWithdrawnAction",
    scrabble.setParticipantWithdrawnAction,
    manage,
    { participantId: ID, withdrawn: true },
    {
      ...badIds("participantId", { withdrawn: true }),
      "withdrawn : chaîne": { participantId: ID, withdrawn: "oui" },
    },
  ),
  c(
    "assignParticipantTeamAction",
    scrabble.assignParticipantTeamAction,
    manage,
    { participantId: ID, teamId: ID },
    {
      ...badIds("participantId", { teamId: ID }),
      "équipe : objet": { participantId: ID, teamId: { not: "" } },
    },
  ),
  c(
    "searchMembersForTournamentAction",
    scrabble.searchMembersForTournamentAction,
    manage,
    { tournamentId: ID, q: "diop" },
    {
      "recherche d'un caractère": { tournamentId: ID, q: "d" },
      "recherche : objet": { tournamentId: ID, q: { contains: "" } },
      ...badIds("tournamentId", { q: "diop" }),
    },
  ),
  c(
    "createTeamAction",
    scrabble.createTeamAction,
    manage,
    { tournamentId: ID, name: "Les Baobabs" },
    {
      ...badIds("tournamentId", { name: "Les Baobabs" }),
      "nom vide": { tournamentId: ID, name: "  " },
    },
  ),
  c(
    "renameTeamAction",
    scrabble.renameTeamAction,
    manage,
    { teamId: ID, name: "Les Fromagers" },
    {
      ...badIds("teamId", { name: "Les Fromagers" }),
      "nom géant": { teamId: ID, name: "x".repeat(61) },
    },
  ),
  c("deleteTeamAction", scrabble.deleteTeamAction, manage, { teamId: ID }, badIds("teamId")),
  c(
    "createRoundAction",
    scrabble.createRoundAction,
    manage,
    { tournamentId: ID },
    badIds("tournamentId"),
  ),
  c(
    "setRoundStatusAction",
    scrabble.setRoundStatusAction,
    manage,
    { roundId: ID, status: "COMPLETED" },
    {
      ...badIds("roundId", { status: "COMPLETED" }),
      "statut inconnu": { roundId: ID, status: "DONE" },
    },
  ),
  c("deleteRoundAction", scrabble.deleteRoundAction, manage, { roundId: ID }, badIds("roundId")),
  c(
    "createMatchAction",
    scrabble.createMatchAction,
    manage,
    { roundId: ID, participantAId: ID, participantBId: `${ID.slice(0, -1)}2` },
    {
      "joueur contre lui-même": { roundId: ID, participantAId: ID, participantBId: ID },
      "table négative": { roundId: ID, participantAId: ID, participantBId: "b", tableNumber: -1 },
      ...badIds("roundId", { participantAId: ID, participantBId: "b" }),
    },
  ),
  c("deleteMatchAction", scrabble.deleteMatchAction, manage, { matchId: ID }, badIds("matchId")),
  c(
    "saveScoresAction",
    scrabble.saveScoresAction,
    ["scores.enter"],
    { roundId: ID, entries: [{ participantId: ID, points: 412, isForfeit: false }] },
    {
      ...badIds("roundId", { entries: [{ participantId: ID, points: 412, isForfeit: false }] }),
      "aucun score": { roundId: ID, entries: [] },
      "score négatif": {
        roundId: ID,
        entries: [{ participantId: ID, points: -1, isForfeit: false }],
      },
      "score décimal": {
        roundId: ID,
        entries: [{ participantId: ID, points: 12.5, isForfeit: false }],
      },
      "score démesuré": {
        roundId: ID,
        entries: [{ participantId: ID, points: 2001, isForfeit: false }],
      },
      "score : chaîne": {
        roundId: ID,
        entries: [{ participantId: ID, points: "412", isForfeit: false }],
      },
      "forfait : chaîne": {
        roundId: ID,
        entries: [{ participantId: ID, points: 0, isForfeit: "oui" }],
      },
      "tableau géant": {
        roundId: ID,
        entries: Array.from({ length: 201 }, () => ({
          participantId: ID,
          points: 1,
          isForfeit: false,
        })),
      },
    },
  ),
  c(
    "validateResultsAction",
    scrabble.validateResultsAction,
    publish,
    { tournamentId: ID },
    badIds("tournamentId"),
  ),
  c(
    "invalidateResultsAction",
    scrabble.invalidateResultsAction,
    publish,
    { tournamentId: ID, reason: "Score mal saisi" },
    {
      ...badIds("tournamentId", { reason: "Score mal saisi" }),
      "motif vide": { tournamentId: ID, reason: "  " },
      "motif géant": { tournamentId: ID, reason: "x".repeat(201) },
    },
  ),
  c(
    "publishResultsAction",
    scrabble.publishResultsAction,
    publish,
    { tournamentId: ID },
    badIds("tournamentId"),
  ),
  c("createRecordAction", scrabble.createRecordAction, manage, recordValid, {
    "sans détenteur": { ...recordValid, holderName: "" },
    "deux détenteurs": { ...recordValid, userId: ID },
    "valeur géante": { ...recordValid, value: "x".repeat(61) },
  }),
  c(
    "updateRecordAction",
    scrabble.updateRecordAction,
    manage,
    { id: ID, record: recordValid },
    {
      ...badIds("id", { record: recordValid }),
      "record manquant": { id: ID },
    },
  ),
  c(
    "replaceRecordAction",
    scrabble.replaceRecordAction,
    manage,
    { id: ID, record: recordValid },
    {
      ...badIds("id", { record: recordValid }),
      "catégorie vide": { id: ID, record: { ...recordValid, category: "" } },
    },
  ),
  c("deleteRecordAction", scrabble.deleteRecordAction, manage, { id: ID }, badIds("id")),
];
