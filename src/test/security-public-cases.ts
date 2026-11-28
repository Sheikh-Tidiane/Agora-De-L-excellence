import { interestLabels } from "@/config/activities";
import * as auth from "@/features/auth/actions";
import * as contact from "@/features/contact/actions";
import * as events from "@/features/events/actions";
import * as feedback from "@/features/feedback/actions";
import * as memberships from "@/features/memberships/actions";
import type { ActionResult } from "@/lib/errors";
import { ID, withProto } from "@/test/security-cases";

/**
 * Les Server Actions publiques par nature : pas de session exigée, mais une entrée validée
 * et un débit limité avant tout accès aux comptes ou à la base.
 */
export type PublicCase = {
  key: string;
  run: (input: unknown) => Promise<ActionResult<unknown>>;
  valid: Record<string, unknown>;
  invalid: Record<string, unknown>;
};

const TOKEN = "j".repeat(43);
const password = "une phrase assez longue";
const setPasswordValid = { token: TOKEN, password, confirmation: password };
const signInValid = { email: "awa@exemple.test", password: "x", next: "/member" };
const contactValid = {
  name: "Awa Diop",
  email: "awa@exemple.test",
  subject: "Une question sur les rencontres",
  message: "Bonjour, à quelle heure commencent les rencontres ?",
  website: "",
};
const guestValid = { eventId: ID, name: "Awa Diop", email: "awa@exemple.test" };
export const membershipValid = {
  firstName: "Awa",
  lastName: "Diop",
  email: "awa@exemple.test",
  phone: "",
  ageRange: "FROM_18_TO_25",
  occupation: "STUDENT",
  interests: [Object.keys(interestLabels)[0]],
  motivation: "",
  guardianName: "",
  guardianPhone: "",
  consent: true,
  mediaConsent: false,
  charter: true,
};

const setPasswordInvalid = {
  "jeton manquant": { password, confirmation: password },
  "jeton trop court": { ...setPasswordValid, token: "abc" },
  "jeton géant": { ...setPasswordValid, token: "j".repeat(513) },
  "jeton : objet": { ...setPasswordValid, token: { startsWith: "" } },
  "mot de passe trop court": { token: TOKEN, password: "court", confirmation: "court" },
  "mot de passe géant": { token: TOKEN, password: "x".repeat(129), confirmation: "x".repeat(129) },
  "confirmation différente": { ...setPasswordValid, confirmation: "autre chose" },
};
const tokenInvalid = {
  "jeton manquant": {},
  "jeton trop court": { token: "abc" },
  "jeton géant": { token: "j".repeat(201) },
  "jeton : objet": { token: { not: "" } },
};

const publicCase = <I>(
  key: string,
  run: (input: I) => Promise<ActionResult<unknown>>,
  valid: Record<string, unknown>,
  invalid: Record<string, unknown>,
): PublicCase => ({ key, run: (input) => run(input as I), valid, invalid });

const f = {
  auth: "src/features/auth/actions.ts",
  contact: "src/features/contact/actions.ts",
  events: "src/features/events/actions.ts",
  feedback: "src/features/feedback/actions.ts",
  memberships: "src/features/memberships/actions.ts",
};

export const publicCases: PublicCase[] = [
  publicCase(`${f.auth}#signInAction`, auth.signInAction, signInValid, {
    "adresse e-mail invalide": { ...signInValid, email: "awa" },
    "adresse : objet": { ...signInValid, email: { contains: "@" } },
    "mot de passe manquant": { email: signInValid.email },
    "mot de passe géant": { ...signInValid, password: "x".repeat(129) },
    "destination géante": { ...signInValid, next: `/member/${"a".repeat(600)}` },
    "propriété __proto__ et adresse manquante": withProto({ password: "x" }),
  }),
  publicCase(
    `${f.auth}#forgotPasswordAction`,
    auth.forgotPasswordAction,
    { email: signInValid.email },
    {
      "adresse e-mail invalide": { email: "awa@" },
      "adresse géante": { email: `${"a".repeat(250)}@exemple.test` },
      "adresse : tableau": { email: ["a@exemple.test", "b@exemple.test"] },
    },
  ),
  publicCase(
    `${f.auth}#resetPasswordAction`,
    auth.resetPasswordAction,
    setPasswordValid,
    setPasswordInvalid,
  ),
  publicCase(
    `${f.auth}#activateAccountAction`,
    auth.activateAccountAction,
    setPasswordValid,
    setPasswordInvalid,
  ),
  publicCase(
    `${f.contact}#sendContactMessageAction`,
    contact.sendContactMessageAction,
    contactValid,
    {
      "message trop court": { ...contactValid, message: "Bonjour" },
      "message géant": { ...contactValid, message: "x".repeat(3001) },
      "objet avec saut de ligne (en-tête forgé)": {
        ...contactValid,
        subject: "Bonjour\r\nBcc: tiers@exemple.test",
      },
      "adresse e-mail invalide": { ...contactValid, email: "awa" },
      "nom : objet": { ...contactValid, name: {} },
      "champ piège géant": { ...contactValid, website: "x".repeat(201) },
    },
  ),
  publicCase(
    `${f.memberships}#submitMembershipRequestAction`,
    memberships.submitMembershipRequestAction,
    membershipValid,
    {
      "charte non acceptée": { ...membershipValid, charter: false },
      "accord : chaîne": { ...membershipValid, consent: "true" },
      "accord images : chaîne": { ...membershipValid, mediaConsent: "oui" },
      "tranche d'âge inconnue": { ...membershipValid, ageRange: "OVER_99" },
      "mineur sans parent ou tuteur": { ...membershipValid, ageRange: "UNDER_15" },
      "centre d'intérêt inconnu": { ...membershipValid, interests: ["hacking"] },
      "centres d'intérêt : tableau géant": {
        ...membershipValid,
        interests: Array.from({ length: 2000 }, () => membershipValid.interests[0]),
      },
      "téléphone invalide": { ...membershipValid, phone: "12" },
      "motivation géante": { ...membershipValid, motivation: "x".repeat(1001) },
      "statut glissé dans la requête, nom manquant": {
        ...membershipValid,
        lastName: "",
        status: "APPROVED",
      },
    },
  ),
  publicCase(`${f.events}#registerGuestAction`, events.registerGuestAction, guestValid, {
    "rencontre : identifiant vide": { ...guestValid, eventId: "" },
    "rencontre : objet": { ...guestValid, eventId: { not: "" } },
    "nom manquant": { ...guestValid, name: "" },
    "nom géant": { ...guestValid, name: "x".repeat(81) },
    "adresse e-mail invalide": { ...guestValid, email: "awa@" },
  }),
  publicCase(`${f.events}#joinWaitlistGuestAction`, events.joinWaitlistGuestAction, guestValid, {
    "rencontre : identifiant vide": { ...guestValid, eventId: "" },
    "rencontre : objet": { ...guestValid, eventId: { not: "" } },
    "nom manquant": { ...guestValid, name: "" },
    "nom géant": { ...guestValid, name: "x".repeat(81) },
    "adresse e-mail invalide": { ...guestValid, email: "awa@" },
  }),
  publicCase(
    `${f.events}#confirmGuestRegistrationAction`,
    events.confirmGuestRegistrationAction,
    { token: TOKEN },
    tokenInvalid,
  ),
  publicCase(
    `${f.events}#cancelGuestRegistrationAction`,
    events.cancelGuestRegistrationAction,
    { token: TOKEN },
    tokenInvalid,
  ),
  publicCase(
    `${f.feedback}#saveGuestFeedbackAction`,
    feedback.saveGuestFeedbackAction,
    { token: TOKEN, rating: 4, comment: "" },
    {
      ...tokenInvalid,
      "note manquante": { token: TOKEN, comment: "" },
      "note hors bornes": { token: TOKEN, rating: 9, comment: "" },
      "note : chaîne": { token: TOKEN, rating: "5", comment: "" },
      "commentaire géant": { token: TOKEN, rating: 4, comment: "x".repeat(5001) },
    },
  ),
];

/** Publique et sans entrée : fermer une session ne donne accès à rien (voir le commentaire de l'action). */
export const signOutKey = `${f.auth}#signOutAction`;
