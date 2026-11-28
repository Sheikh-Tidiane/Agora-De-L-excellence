import * as admin from "@/features/admin/actions";
import * as articles from "@/features/articles/actions";
import * as roles from "@/features/auth/roles-actions";
import * as committee from "@/features/committee/actions";
import * as contact from "@/features/contact/actions";
import * as events from "@/features/events/actions";
import * as eventsAdmin from "@/features/events/admin-actions";
import * as gamification from "@/features/gamification/actions";
import { eventTypeCodes } from "@/features/events/rules";
import * as library from "@/features/library/actions";
import * as members from "@/features/members/actions";
import * as memberCard from "@/features/members/card-actions";
import * as profile from "@/features/members/profile-actions";
import * as readings from "@/features/readings/actions";
import * as memberships from "@/features/memberships/actions";
import * as notifications from "@/features/notifications/actions";
import * as payments from "@/features/payments/actions";
import * as settings from "@/features/settings/actions";
import { defaultClubSettings } from "@/features/settings/schemas";
import { quizCases } from "@/test/security-cases-quizzes";
import { scrabbleCases } from "@/test/security-cases-scrabble";
import type { ActionResult } from "@/lib/errors";
import type { PermissionCode } from "@/lib/permissions/catalog";

/**
 * Les Server Actions protégées : la permission exigée, une entrée valide, et des entrées
 * mal formées comme une requête forgée peut en envoyer (la validation du navigateur est contournée).
 */
export type ProtectedCase = {
  /** `fichier#export`, comparé à la liste des exports des fichiers `"use server"`. */
  key: string;
  run: (input: unknown) => Promise<ActionResult<unknown>>;
  /** Une de ces permissions suffit ; `"session"` : tout utilisateur connecté. */
  allow: readonly PermissionCode[] | "session";
  valid: Record<string, unknown>;
  invalid: Record<string, unknown>;
};

export const ID = "ckx1a2b3c4d5e6f7g8h9i0j1k";
/** Version (date ISO) de la critique affichée au modérateur. */
const REVIEW_VERSION = "2026-11-14T10:00:00.000Z";
const LONG_ID = "x".repeat(41);
/** Objet dont `__proto__` est une vraie propriété, comme après `JSON.parse` d'une requête forgée. */
export const withProto = (base: object, extra: object = {}): Record<string, unknown> =>
  Object.assign(JSON.parse('{"__proto__":{"isAdmin":true},"constructor":{"prototype":{}}}'), {
    ...base,
    ...extra,
  });

type Run<I> = (input: I) => Promise<ActionResult<unknown>>;
function protectedCase<I>(
  key: string,
  run: Run<I>,
  allow: ProtectedCase["allow"],
  valid: Record<string, unknown>,
  invalid: Record<string, unknown>,
): ProtectedCase {
  return { key, run: (input) => run(input as I), allow, valid, invalid };
}

export const articleValid = {
  title: "Retour sur le premier débat d’idées",
  category: "Compte rendu",
  excerpt: "Ce qu’il faut retenir de la soirée, en quelques lignes.",
  content: "Un texte d’article suffisamment long pour passer la validation du serveur.",
  publishedAt: "",
};
const cardValid = {
  userId: ID,
  method: "WAVE",
  reference: "T_7Q2KX9",
  paidAt: "2026-11-01",
  note: "",
};

export const eventValid = {
  title: "Rendez-vous lecture de janvier",
  type: eventTypeCodes[0],
  activities: [eventTypeCodes[0]],
  summary: "",
  description: "Une rencontre autour du livre du mois.",
  location: "",
  isTentative: false,
  program: "",
  speakerName: "",
  speakerTitle: "",
  speakerMode: "",
  videoLink: "",
  startsAt: "2027-01-10T16:00",
  endsAt: "",
  capacity: "",
  isPublic: true,
  cancellationDeadlineHours: "",
};
export const bookValid = {
  id: "",
  title: "Une si longue lettre",
  subtitle: "",
  authors: "Mariama Bâ",
  categoryId: ID,
  summary: "Un résumé rédigé pour le club, assez long pour être accepté.",
  clubNote: "",
  isClubFavorite: false,
  isPublished: true,
  publisher: "",
  publishedYear: "",
  pageCount: "",
  isbn: "",
  language: "fr",
  coverImage: "",
};
const committeeValid = { id: "", name: "Yaye Diop", role: "", bio: "", photo: "" };
const memberValid = { userId: ID, firstName: "Awa", lastName: "Diop", phone: "" };
const staffValid = {
  firstName: "Moussa",
  lastName: "Fall",
  email: "moussa.fall@exemple.test",
  roles: ["library"],
};
const readingValid = {
  readingId: ID,
  status: "READING",
  progress: 40,
  personalNote: "",
  isFavorite: false,
};
const reviewValid = {
  bookId: ID,
  rating: 4,
  content:
    "Un livre exigeant, qui m’a obligé à revenir sur mes certitudes ; la seconde partie est plus lente mais elle prépare la fin.",
  publishWithFirstName: true,
};
const charterValid = { content: "- Respecter les opinions des autres.", provisional: true };

const f = {
  admin: "src/features/admin/actions.ts",
  articles: "src/features/articles/actions.ts",
  roles: "src/features/auth/roles-actions.ts",
  committee: "src/features/committee/actions.ts",
  contact: "src/features/contact/actions.ts",
  events: "src/features/events/actions.ts",
  eventsAdmin: "src/features/events/admin-actions.ts",
  gamification: "src/features/gamification/actions.ts",
  library: "src/features/library/actions.ts",
  members: "src/features/members/actions.ts",
  profile: "src/features/members/profile-actions.ts",
  readings: "src/features/readings/actions.ts",
  memberCard: "src/features/members/card-actions.ts",
  memberships: "src/features/memberships/actions.ts",
  payments: "src/features/payments/actions.ts",
  settings: "src/features/settings/actions.ts",
};

/** Mauvais identifiants, pour un champ donné. */
const badIds = (field: string, base: object = {}) => ({
  [`${field} vide`]: { ...base, [field]: "" },
  [`${field} : objet à la place d'une chaîne`]: { ...base, [field]: { not: "" } },
  [`${field} trop long`]: { ...base, [field]: LONG_ID },
  [`${field} : tableau`]: { ...base, [field]: [ID] },
  [`${field} manquant`]: { ...base, [field]: undefined },
});

export const protectedCases: ProtectedCase[] = [
  protectedCase(
    `${f.admin}#adminSearchAction`,
    admin.adminSearchAction,
    ["admin.access"],
    { q: "diop" },
    {
      "recherche d'un seul caractère": { q: "a" },
      "recherche trop longue": { q: "a".repeat(61) },
      "objet à la place du texte": { q: { contains: "" } },
      "propriété __proto__ et champ manquant": withProto({}),
    },
  ),

  protectedCase(
    `${f.articles}#saveArticleAction`,
    articles.saveArticleAction,
    ["articles.manage"],
    articleValid,
    {
      "titre manquant": { ...articleValid, title: undefined },
      "texte géant": { ...articleValid, content: "x".repeat(40_001) },
      "date de publication illisible": { ...articleValid, publishedAt: "demain" },
      "id : objet à la place d'une chaîne": { ...articleValid, id: { not: "" } },
      "id : nombre": { ...articleValid, id: 0 },
      "id trop long": { ...articleValid, id: LONG_ID },
      "propriété __proto__ et rubrique numérique": withProto(articleValid, { category: 12 }),
    },
  ),
  protectedCase(
    `${f.articles}#setArticleStatusAction`,
    articles.setArticleStatusAction,
    ["articles.manage"],
    { id: ID, status: "PUBLISHED" },
    { ...badIds("id", { status: "PUBLISHED" }), "statut inconnu": { id: ID, status: "DELETED" } },
  ),

  protectedCase(
    `${f.roles}#createStaffAccountAction`,
    roles.createStaffAccountAction,
    ["roles.manage"],
    staffValid,
    {
      "rôle inconnu": { ...staffValid, roles: ["root"] },
      "aucun rôle": { ...staffValid, roles: [] },
      "rôles : chaîne à la place du tableau": { ...staffValid, roles: "super_admin" },
      "adresse e-mail invalide": { ...staffValid, email: "pas-une-adresse" },
      "tableau de rôles géant": {
        ...staffValid,
        roles: Array.from({ length: 5000 }, () => "admin"),
      },
    },
  ),
  protectedCase(
    `${f.roles}#setUserRolesAction`,
    roles.setUserRolesAction,
    ["roles.manage"],
    { userId: ID, roles: ["member"] },
    {
      ...badIds("userId", { roles: ["member"] }),
      "rôle inconnu": { userId: ID, roles: ["member", "owner"] },
      "rôles manquants": { userId: ID },
      "tableau de rôles géant": { userId: ID, roles: Array.from({ length: 5000 }, () => "admin") },
    },
  ),

  protectedCase(
    `${f.committee}#saveCommitteeMemberAction`,
    committee.saveCommitteeMemberAction,
    ["settings.manage"],
    committeeValid,
    {
      "nom manquant": { ...committeeValid, name: "" },
      "photo : chemin libre": { ...committeeValid, photo: "../../etc/passwd" },
      "photo : adresse externe": { ...committeeValid, photo: "https://exemple.test/x.jpg" },
      "biographie géante": { ...committeeValid, bio: "x".repeat(601) },
      "id : objet": { ...committeeValid, id: { not: "" } },
    },
  ),
  protectedCase(
    `${f.committee}#removeCommitteeMemberAction`,
    committee.removeCommitteeMemberAction,
    ["settings.manage"],
    { id: ID },
    badIds("id"),
  ),
  protectedCase(
    `${f.committee}#moveCommitteeMemberAction`,
    committee.moveCommitteeMemberAction,
    ["settings.manage"],
    { id: ID, direction: "up" },
    { ...badIds("id", { direction: "up" }), "direction inconnue": { id: ID, direction: "left" } },
  ),

  protectedCase(
    `${f.events}#registerMemberAction`,
    events.registerMemberAction,
    "session",
    { eventId: ID },
    badIds("eventId"),
  ),
  protectedCase(
    `${f.events}#cancelMemberRegistrationAction`,
    events.cancelMemberRegistrationAction,
    "session",
    { registrationId: ID },
    badIds("registrationId"),
  ),

  protectedCase(
    `${f.eventsAdmin}#saveEventAction`,
    eventsAdmin.saveEventAction,
    ["events.manage"],
    eventValid,
    {
      "type inconnu": { ...eventValid, type: "CONCERT" },
      "activités : liste vide": { ...eventValid, activities: [] },
      "activités : activité inconnue": { ...eventValid, activities: ["CONCERT"] },
      "activités : chaîne": { ...eventValid, activities: "RENDEZ_VOUS_LECTURE" },
      "activité principale hors de la liste": { ...eventValid, activities: ["AGORA_CINE"] },
      "activités : liste géante": {
        ...eventValid,
        activities: Array.from({ length: 2000 }, () => eventTypeCodes[0]),
      },
      "début manquant": { ...eventValid, startsAt: "" },
      "fin illisible": { ...eventValid, endsAt: "plus tard" },
      "fin avant le début": { ...eventValid, endsAt: "2027-01-10T15:00" },
      "capacité négative": { ...eventValid, capacity: -5 },
      "capacité : objet": { ...eventValid, capacity: { gt: 0 } },
      "lien de visio en javascript:": { ...eventValid, videoLink: "javascript:alert(1)" },
      "isPublic : chaîne": { ...eventValid, isPublic: "true" },
      "id : objet à la place d'une chaîne": { ...eventValid, id: { not: "" } },
      "id : nombre": { ...eventValid, id: 0 },
      "id trop long": { ...eventValid, id: LONG_ID },
    },
  ),
  protectedCase(
    `${f.eventsAdmin}#setEventStatusAction`,
    eventsAdmin.setEventStatusAction,
    ["events.manage"],
    { eventId: ID, status: "PUBLISHED" },
    {
      ...badIds("eventId", { status: "PUBLISHED" }),
      "statut inconnu": { eventId: ID, status: "ARCHIVED" },
    },
  ),
  protectedCase(
    `${f.eventsAdmin}#saveEventReportAction`,
    eventsAdmin.saveEventReportAction,
    ["events.manage"],
    { eventId: ID, content: "Une belle soirée.", publish: false },
    {
      ...badIds("eventId", { content: "", publish: false }),
      "compte rendu géant": { eventId: ID, content: "x".repeat(20_001), publish: false },
      "publish : chaîne": { eventId: ID, content: "", publish: "oui" },
    },
  ),
  protectedCase(
    `${f.eventsAdmin}#archiveEventAction`,
    eventsAdmin.archiveEventAction,
    ["events.manage"],
    { id: ID },
    badIds("id"),
  ),
  protectedCase(
    `${f.eventsAdmin}#removeRegistrationAction`,
    eventsAdmin.removeRegistrationAction,
    ["events.manage"],
    { registrationId: ID },
    badIds("registrationId"),
  ),

  protectedCase(
    `${f.library}#saveBookAction`,
    library.saveBookAction,
    ["books.manage"],
    bookValid,
    {
      "titre manquant": { ...bookValid, title: "" },
      "langue inconnue": { ...bookValid, language: "xx" },
      "couverture : chemin libre": { ...bookValid, coverImage: "covers/../../secret.jpg" },
      "catégorie : objet": { ...bookValid, categoryId: { not: "" } },
      "catégorie : identifiant trop long": { ...bookValid, categoryId: LONG_ID },
      "année hors bornes": { ...bookValid, publishedYear: "99999" },
      "auteurs : tableau": { ...bookValid, authors: ["Mariama Bâ"] },
      "id : objet": { ...bookValid, id: { not: "" } },
    },
  ),
  protectedCase(
    `${f.library}#setBookArchivedAction`,
    library.setBookArchivedAction,
    ["books.manage"],
    { id: ID, archived: true },
    { ...badIds("id", { archived: true }), "archived : chaîne": { id: ID, archived: "true" } },
  ),
  protectedCase(
    `${f.library}#saveCategoryAction`,
    library.saveCategoryAction,
    ["books.manage"],
    { id: "", name: "Romans", description: "" },
    {
      "nom trop court": { id: "", name: "R", description: "" },
      "description géante": { id: "", name: "Romans", description: "x".repeat(301) },
      "id : objet": { id: { not: "" }, name: "Romans", description: "" },
    },
  ),
  protectedCase(
    `${f.library}#deleteCategoryAction`,
    library.deleteCategoryAction,
    ["books.manage"],
    { id: ID },
    badIds("id"),
  ),
  protectedCase(
    `${f.library}#saveAuthorAction`,
    library.saveAuthorAction,
    ["books.manage"],
    { id: "", name: "Mariama Bâ", bio: "" },
    {
      "nom manquant": { id: "", bio: "" },
      "biographie géante": { id: "", name: "Mariama Bâ", bio: "x".repeat(1201) },
      "id trop long": { id: LONG_ID, name: "Mariama Bâ", bio: "" },
    },
  ),
  protectedCase(
    `${f.library}#deleteAuthorAction`,
    library.deleteAuthorAction,
    ["books.manage"],
    { id: ID },
    badIds("id"),
  ),
  protectedCase(
    `${f.library}#saveSelectionAction`,
    library.saveSelectionAction,
    ["books.manage"],
    { month: "2026-11", bookId: ID, eventId: "", note: "" },
    {
      "mois impossible": { month: "2026-13", bookId: ID, eventId: "", note: "" },
      "livre : objet": { month: "2026-11", bookId: { not: "" }, eventId: "", note: "" },
      "livre : identifiant trop long": { month: "2026-11", bookId: LONG_ID, eventId: "", note: "" },
      "rencontre : identifiant trop long": {
        month: "2026-11",
        bookId: ID,
        eventId: LONG_ID,
        note: "",
      },
    },
  ),
  protectedCase(
    `${f.library}#deleteSelectionAction`,
    library.deleteSelectionAction,
    ["books.manage"],
    { id: ID },
    badIds("id"),
  ),

  protectedCase(
    `${f.members}#updateMemberAction`,
    members.updateMemberAction,
    ["members.manage"],
    memberValid,
    {
      ...badIds("userId", memberValid),
      "prénom manquant": { ...memberValid, firstName: "" },
      "téléphone invalide": { ...memberValid, phone: "abc" },
      "nom géant": { ...memberValid, lastName: "x".repeat(61) },
    },
  ),
  protectedCase(
    `${f.members}#suspendMemberAction`,
    members.suspendMemberAction,
    ["members.manage"],
    { userId: ID, reason: "" },
    {
      ...badIds("userId", { reason: "" }),
      "motif géant": { userId: ID, reason: "x".repeat(301) },
      "motif : objet": { userId: ID, reason: {} },
    },
  ),
  protectedCase(
    `${f.members}#reactivateMemberAction`,
    members.reactivateMemberAction,
    ["members.manage"],
    { userId: ID },
    badIds("userId"),
  ),
  protectedCase(
    `${f.members}#renewMembershipAction`,
    members.renewMembershipAction,
    ["members.manage"],
    { userId: ID },
    badIds("userId"),
  ),
  protectedCase(
    `${f.members}#archiveMemberAction`,
    members.archiveMemberAction,
    ["members.manage"],
    { userId: ID },
    badIds("userId"),
  ),
  protectedCase(
    `${f.members}#resendActivationAction`,
    members.resendActivationAction,
    ["members.manage"],
    { userId: ID },
    badIds("userId"),
  ),
  protectedCase(
    `${f.memberCard}#regenerateMyCardAction`,
    memberCard.regenerateMyCardAction,
    ["member.access"],
    { confirm: true },
    {
      "confirmation absente": {},
      "confirmation : chaîne": { confirm: "true" },
      "confirmation fausse": { confirm: false },
      "identifiant d'un autre glissé, sans confirmation": { userId: ID },
    },
  ),
  protectedCase(
    `${f.memberCard}#revokeMemberCardAction`,
    memberCard.revokeMemberCardAction,
    ["members.manage"],
    { userId: ID, reason: "Téléphone perdu" },
    {
      ...badIds("userId", { reason: "Téléphone perdu" }),
      "motif manquant": { userId: ID, reason: "  " },
      "motif géant": { userId: ID, reason: "x".repeat(301) },
      "motif : objet": { userId: ID, reason: {} },
    },
  ),
  protectedCase(
    `${f.readings}#addReadingAction`,
    readings.addReadingAction,
    ["member.access"],
    { bookId: ID, status: "READING" },
    {
      ...badIds("bookId", { status: "READING" }),
      "statut inconnu": { bookId: ID, status: "LU" },
    },
  ),
  protectedCase(
    `${f.readings}#updateReadingAction`,
    readings.updateReadingAction,
    ["member.access"],
    readingValid,
    {
      ...badIds("readingId", readingValid),
      "progression > 100": { ...readingValid, progress: 101 },
      "progression négative": { ...readingValid, progress: -1 },
      "progression décimale": { ...readingValid, progress: 12.5 },
      "note trop longue": { ...readingValid, personalNote: "a".repeat(2001) },
      "favori : chaîne": { ...readingValid, isFavorite: "oui" },
    },
  ),
  protectedCase(
    `${f.readings}#submitReadingAction`,
    readings.submitReadingAction,
    ["member.access"],
    { readingId: ID },
    badIds("readingId"),
  ),
  protectedCase(
    `${f.readings}#removeReadingAction`,
    readings.removeReadingAction,
    ["member.access"],
    { readingId: ID },
    badIds("readingId"),
  ),
  protectedCase(
    `${f.readings}#saveReviewAction`,
    readings.saveReviewAction,
    ["member.access"],
    reviewValid,
    {
      ...badIds("bookId", reviewValid),
      "note 0": { ...reviewValid, rating: 0 },
      "note 6": { ...reviewValid, rating: 6 },
      "texte trop court": { ...reviewValid, content: "Bien." },
      "texte trop long": { ...reviewValid, content: "a".repeat(4001) },
      "publication : chaîne": { ...reviewValid, publishWithFirstName: "oui" },
    },
  ),
  protectedCase(
    `${f.readings}#decideReadingAction`,
    readings.decideReadingAction,
    ["readings.validate"],
    { id: ID, decision: "approve", note: "" },
    {
      ...badIds("id", { decision: "approve", note: "" }),
      "décision inconnue": { id: ID, decision: "maybe", note: "" },
      "refus sans motif": { id: ID, decision: "reject", note: "" },
    },
  ),
  protectedCase(
    `${f.readings}#decideReviewAction`,
    readings.decideReviewAction,
    ["reviews.moderate"],
    { id: ID, decision: "reject", note: "Merci de développer un peu.", version: REVIEW_VERSION },
    {
      ...badIds("id", { decision: "approve", note: "", version: REVIEW_VERSION }),
      "refus sans motif": { id: ID, decision: "reject", note: "   ", version: REVIEW_VERSION },
      "motif trop long": {
        id: ID,
        decision: "reject",
        note: "a".repeat(501),
        version: REVIEW_VERSION,
      },
      "version absente": { id: ID, decision: "approve", note: "" },
      "version illisible": { id: ID, decision: "approve", note: "", version: "hier" },
    },
  ),
  protectedCase(
    `${f.profile}#updateOwnProfileAction`,
    profile.updateOwnProfileAction,
    ["member.access"],
    { phone: "77 123 45 67", hiddenFromRankings: false, eventReminders: true },
    {
      "téléphone invalide": { phone: "abc", hiddenFromRankings: false, eventReminders: true },
      "téléphone trop long": {
        phone: "7".repeat(31),
        hiddenFromRankings: false,
        eventReminders: true,
      },
      "retrait des classements : chaîne": {
        phone: "",
        hiddenFromRankings: "oui",
        eventReminders: true,
      },
      "retrait des classements manquant": { phone: "", eventReminders: true },
      "rappels : chaîne": { phone: "", hiddenFromRankings: false, eventReminders: "oui" },
      "rappels manquants": { phone: "", hiddenFromRankings: false },
      "téléphone : objet": { phone: { not: "" }, hiddenFromRankings: false, eventReminders: true },
    },
  ),

  protectedCase(
    `${f.memberships}#approveRequestsAction`,
    memberships.approveRequestsAction,
    ["memberships.review"],
    { ids: [ID] },
    {
      "aucune demande": { ids: [] },
      "tableau géant": { ids: Array.from({ length: 101 }, () => ID) },
      "ids : chaîne à la place du tableau": { ids: ID },
      "un identifiant vide": { ids: [ID, ""] },
      "un identifiant objet": { ids: [{ not: "" }] },
    },
  ),
  protectedCase(
    `${f.memberships}#rejectRequestAction`,
    memberships.rejectRequestAction,
    ["memberships.review"],
    { id: ID, reason: "" },
    { ...badIds("id", { reason: "" }), "motif géant": { id: ID, reason: "x".repeat(501) } },
  ),

  protectedCase(
    `${f.contact}#setContactMessageStatusAction`,
    contact.setContactMessageStatusAction,
    ["contact.manage"],
    { id: ID, status: "HANDLED" },
    {
      ...badIds("id", { status: "HANDLED" }),
      "statut inconnu": { id: ID, status: "ARCHIVED" },
      "statut en minuscules": { id: ID, status: "handled" },
      "statut manquant": { id: ID },
    },
  ),

  protectedCase(
    `${f.payments}#recordCardPaymentAction`,
    payments.recordCardPaymentAction,
    ["payments.record"],
    cardValid,
    {
      ...badIds("userId", { ...cardValid, userId: undefined }),
      "date illisible": { ...cardValid, paidAt: "hier" },
      "date impossible": { ...cardValid, paidAt: "2026-13-45" },
      "montant glissé dans la requête, date manquante": {
        ...cardValid,
        paidAt: undefined,
        amount: 1,
      },
      "note géante": { ...cardValid, note: "x".repeat(201) },
      "moyen inconnu": { ...cardValid, method: "BITCOIN" },
      "moyen manquant": { ...cardValid, method: undefined },
      "Wave sans référence": { ...cardValid, method: "WAVE", reference: "" },
      "Orange Money, référence d'espaces": {
        ...cardValid,
        method: "ORANGE_MONEY",
        reference: "   ",
      },
      "référence géante": { ...cardValid, method: "WAVE", reference: "T".repeat(61) },
      "référence piégée": { ...cardValid, method: "WAVE", reference: "<script>alert(1)</script>" },
      "référence : objet": { ...cardValid, method: "WAVE", reference: { not: "" } },
    },
  ),
  protectedCase(
    `${f.payments}#cancelPaymentAction`,
    payments.cancelPaymentAction,
    ["payments.record"],
    { paymentId: ID, reason: "Saisi deux fois" },
    {
      ...badIds("paymentId", { reason: "Saisi deux fois" }),
      "motif manquant": { paymentId: ID, reason: "  " },
      "motif géant": { paymentId: ID, reason: "x".repeat(201) },
    },
  ),
  protectedCase(
    `${f.payments}#recordAttendanceAction`,
    payments.recordAttendanceAction,
    ["attendance.record", "payments.record"],
    { registrationId: ID, present: true, paid: false },
    {
      ...badIds("registrationId", { present: true, paid: false }),
      "present : chaîne": { registrationId: ID, present: "true", paid: false },
      "paid manquant": { registrationId: ID, present: true },
    },
  ),

  protectedCase(
    `${f.gamification}#grantManualPointsAction`,
    gamification.grantManualPointsAction,
    ["points.grant"],
    { userId: ID, points: 25, reason: "Animation du débat" },
    {
      ...badIds("userId", { points: 25, reason: "Animation du débat" }),
      "zéro point": { userId: ID, points: 0, reason: "Rien" },
      "points décimaux": { userId: ID, points: 2.5, reason: "Demi" },
      "points : chaîne": { userId: ID, points: "25", reason: "Chaîne" },
      "au-delà de 1 000": { userId: ID, points: 1001, reason: "Trop" },
      "en deçà de −1 000": { userId: ID, points: -1001, reason: "Trop" },
      "motif vide": { userId: ID, points: 5, reason: "  " },
      "motif géant": { userId: ID, points: 5, reason: "x".repeat(201) },
    },
  ),
  protectedCase(
    `${f.gamification}#reversePointTransactionAction`,
    gamification.reversePointTransactionAction,
    ["points.grant"],
    { transactionId: ID, reason: "Erreur de pointage" },
    {
      ...badIds("transactionId", { reason: "Erreur de pointage" }),
      "motif manquant": { transactionId: ID },
    },
  ),
  protectedCase(
    `${f.gamification}#awardManualBadgeAction`,
    gamification.awardManualBadgeAction,
    ["badges.award"],
    { userId: ID, badgeCode: "ambassadeur_du_savoir", reason: "Club de lecture au lycée" },
    {
      ...badIds("userId", { badgeCode: "ambassadeur_du_savoir", reason: "Motif" }),
      "code de badge forgé": { userId: ID, badgeCode: "x' OR 1=1", reason: "Motif" },
      "code : objet": { userId: ID, badgeCode: { not: "" }, reason: "Motif" },
      "motif vide": { userId: ID, badgeCode: "ambassadeur_du_savoir", reason: "" },
    },
  ),
  protectedCase(
    `${f.gamification}#updatePointRuleAction`,
    gamification.updatePointRuleAction,
    ["points.rules.manage"],
    { id: ID, points: 20, isActive: true },
    {
      ...badIds("id", { points: 20, isActive: true }),
      "points négatifs": { id: ID, points: -1, isActive: true },
      "au-delà de 1 000": { id: ID, points: 1001, isActive: true },
      "points : chaîne": { id: ID, points: "20", isActive: true },
      "actif : chaîne": { id: ID, points: 20, isActive: "true" },
    },
  ),
  protectedCase(
    `${f.gamification}#setAttendancePointModeAction`,
    gamification.setAttendancePointModeAction,
    ["points.rules.manage"],
    { mode: "PRIMARY_ONLY" },
    {
      "règle inconnue": { mode: "EVERYTHING" },
      "règle vide": { mode: "" },
      "règle : objet": { mode: { not: "" } },
      "règle manquante": {},
    },
  ),

  protectedCase(
    `${f.settings}#saveClubSettingsAction`,
    settings.saveClubSettingsAction,
    ["settings.manage"],
    defaultClubSettings,
    {
      "nom du club manquant": { ...defaultClubSettings, name: "" },
      "montant négatif": { ...defaultClubSettings, membershipCardFee: -1 },
      "montant vide": { ...defaultClubSettings, membershipCardFee: "" },
      "montant null": { ...defaultClubSettings, sessionFee: null },
      "montant booléen": { ...defaultClubSettings, sessionFee: true },
      "montant : tableau": { ...defaultClubSettings, sessionFee: ["100"] },
      "montant décimal": { ...defaultClubSettings, sessionFee: "100.5" },
      "durée d'adhésion nulle": { ...defaultClubSettings, membershipDurationMonths: 0 },
      "réseau social sans https": { ...defaultClubSettings, facebook: "javascript:alert(1)" },
      "adresse e-mail invalide": { ...defaultClubSettings, email: "club@" },
      "numéro Wave : texte": { ...defaultClubSettings, waveNumber: "appelez-nous" },
      "numéro Orange Money : objet": { ...defaultClubSettings, orangeMoneyNumber: { a: 1 } },
      "délai de grâce nul": { ...defaultClubSettings, cardGraceDays: 0 },
      "délai de grâce au-delà d'un an": { ...defaultClubSettings, cardGraceDays: 366 },
      "masquage : chaîne": { ...defaultClubSettings, hideVideoWhenCardUnpaid: "true" },
      "rappels : chaîne": { ...defaultClubSettings, eventRemindersEnabled: "true" },
      "heure du rappel : 24": { ...defaultClubSettings, eventReminderHour: 24 },
      "heure du rappel : « 10h »": { ...defaultClubSettings, eventReminderHour: "10h" },
    },
  ),
  protectedCase(
    `${f.settings}#saveCharterAction`,
    settings.saveCharterAction,
    ["settings.manage"],
    charterValid,
    {
      "charte vide": { ...charterValid, content: "   " },
      "charte géante": { ...charterValid, content: "x".repeat(20_001) },
      "provisional : chaîne": { ...charterValid, provisional: "false" },
    },
  ),
  protectedCase(
    "src/features/notifications/actions.ts#markNotificationReadAction",
    notifications.markNotificationReadAction,
    "session",
    { id: ID },
    badIds("id"),
  ),
  protectedCase(
    "src/features/notifications/actions.ts#markAllNotificationsReadAction",
    notifications.markAllNotificationsReadAction,
    "session",
    {},
    { "champ inattendu": { userId: ID } },
  ),
  ...quizCases,
  ...scrabbleCases,
];

/** Entrées qui ne sont même pas des objets : refusées par toutes les actions. */
export const notObjects: Record<string, unknown> = {
  null: null,
  undefined: undefined,
  "une chaîne": "id=1",
  "un nombre": 42,
  "un tableau": [ID],
};
