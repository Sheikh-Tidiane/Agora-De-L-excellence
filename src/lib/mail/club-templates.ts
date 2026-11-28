import { site } from "@/config/site";
import type { MailMessage } from "@/lib/mail";
import { build } from "@/lib/mail/templates";

/** E-mails de la vie du club : adhésion, inscriptions aux rencontres, contact. */

export function membershipReceivedEmail(input: { to: string; firstName: string }): MailMessage {
  return build(input.to, `Votre demande d’adhésion est bien arrivée · ${site.name}`, {
    preheader: "Un responsable du club la lit et vous répond par e-mail.",
    surtitre: "Adhésion",
    title: `${input.firstName}, nous avons votre demande.`,
    paragraphs: [
      `Merci de vouloir rejoindre ${site.name}. Votre demande d’adhésion est enregistrée.`,
      "Un responsable du club la lit, puis vous écrit à cette adresse. Si elle est acceptée, vous recevrez un lien pour activer votre espace membre.",
    ],
    notes: [
      "Vous n’avez rien à faire d’ici là.",
      "Vous n’êtes pas à l’origine de cette demande ? Ignorez ce message : sans validation, aucun compte n’est créé.",
    ],
  });
}

export function membershipRejectedEmail(input: {
  to: string;
  firstName: string;
  reason?: string | null;
}): MailMessage {
  return build(input.to, `Votre demande d’adhésion · ${site.name}`, {
    preheader: "Une réponse du club à votre demande d’adhésion.",
    surtitre: "Adhésion",
    title: "Nous ne pouvons pas donner suite pour le moment.",
    paragraphs: [
      `Bonjour ${input.firstName},`,
      `Merci de l’intérêt que vous portez à ${site.name}. Après lecture, votre demande d’adhésion n’a pas été retenue cette fois-ci.`,
      ...(input.reason ? [`Le mot du responsable : ${input.reason}`] : []),
      "Nos rencontres ouvertes au public vous restent accessibles, et vous pouvez nous écrire depuis la page Contact du site.",
    ],
    notes: [],
  });
}

type EventInfo = { title: string; when: string; place: string };

const eventLines = (event: EventInfo) => [`${event.title}`, `${event.when} · ${event.place}`];

export function guestConfirmationEmail(input: {
  to: string;
  name: string;
  event: EventInfo;
  url: string;
  validHours: number;
}): MailMessage {
  return build(input.to, `Confirmez votre inscription · ${input.event.title}`, {
    preheader: "Un clic pour confirmer votre place.",
    surtitre: "Inscription",
    title: "Confirmez votre place.",
    paragraphs: [
      `Bonjour ${input.name},`,
      "Vous avez demandé à participer à cette rencontre :",
      ...eventLines(input.event),
    ],
    action: { label: "Confirmer mon inscription", url: input.url },
    notes: [
      `Sans confirmation dans les ${input.validHours} heures, la place est remise à disposition.`,
      "Ce même lien vous permettra d’annuler votre inscription si vous avez un empêchement.",
      "Vous n’avez rien demandé ? Ignorez ce message.",
    ],
  });
}

export function registrationConfirmedEmail(input: {
  to: string;
  name: string;
  event: EventInfo;
  /** Page où retrouver (et annuler) l'inscription. */
  url: string;
  cancelBefore: string | null;
  calendar: { ics: string; google: string };
}): MailMessage {
  return build(input.to, `Vous êtes inscrit · ${input.event.title}`, {
    preheader: `${input.event.when} · ${input.event.place}`,
    surtitre: "Inscription confirmée",
    title: "Votre place est réservée.",
    paragraphs: [`Bonjour ${input.name},`, "Nous vous attendons :", ...eventLines(input.event)],
    action: { label: "Voir mon inscription", url: input.url },
    links: [
      { label: "Ajouter à mon agenda (fichier .ics)", url: input.calendar.ics },
      { label: "Ajouter à Google Agenda", url: input.calendar.google },
    ],
    notes: [
      input.cancelBefore
        ? `Un empêchement ? Vous pouvez annuler depuis ce lien jusqu’au ${input.cancelBefore}.`
        : "Un empêchement ? Prévenez le club dès que possible.",
    ],
  });
}

/** Invité qui demande une place sur la liste d'attente : il confirme d'abord son adresse. */
export function guestWaitlistConfirmEmail(input: {
  to: string;
  name: string;
  event: EventInfo;
  url: string;
}): MailMessage {
  return build(input.to, `Confirmez votre place sur la liste d’attente · ${input.event.title}`, {
    preheader: "Un clic pour prendre votre rang sur la liste d’attente.",
    surtitre: "Liste d’attente",
    title: "Confirmez votre adresse.",
    paragraphs: [
      `Bonjour ${input.name},`,
      "Cette rencontre est complète. Confirmez votre adresse pour prendre votre rang sur la liste d’attente :",
      ...eventLines(input.event),
    ],
    action: { label: "Confirmer ma place sur la liste", url: input.url },
    notes: [
      "Si une place se libère, vous êtes inscrit d’office et prévenu par e-mail.",
      "Ce même lien vous permet de quitter la liste à tout moment.",
      "Vous n’avez rien demandé ? Ignorez ce message.",
    ],
  });
}

/** Une place s'est libérée : la personne en attente est inscrite d'office (ou par un responsable). */
export function waitlistPromotedEmail(input: {
  to: string;
  name: string;
  event: EventInfo;
  /** Membre : la page de la rencontre ; invité : son lien personnel. */
  url: string;
  calendar: { ics: string; google: string };
  cancelBefore: string | null;
  manual: boolean;
}): MailMessage {
  return build(input.to, `Une place s’est libérée : vous êtes inscrit · ${input.event.title}`, {
    preheader: `${input.event.when} · ${input.event.place}`,
    surtitre: "Liste d’attente",
    title: "Votre place est réservée.",
    paragraphs: [
      `Bonjour ${input.name},`,
      input.manual
        ? "Le club vous a fait une place à cette rencontre :"
        : "Une place s’est libérée à cette rencontre, et vous étiez le premier sur la liste d’attente :",
      ...eventLines(input.event),
    ],
    action: { label: "Voir mon inscription", url: input.url },
    links: [
      { label: "Ajouter à mon agenda (fichier .ics)", url: input.calendar.ics },
      { label: "Ajouter à Google Agenda", url: input.calendar.google },
    ],
    notes: [
      input.cancelBefore
        ? `Un empêchement ? Annulez depuis ce lien avant le ${input.cancelBefore} : la place ira à la personne suivante.`
        : "Un empêchement ? Prévenez le club dès que possible : la place ira à la personne suivante.",
    ],
  });
}

/** Le lendemain d'une rencontre : votre avis (note de 1 à 5, commentaire facultatif). */
export function feedbackRequestEmail(input: {
  to: string;
  name: string;
  title: string;
  date: string;
  url: string;
  closesAt: string;
  /** Invité sans compte : le lien est personnel. */
  guest?: boolean;
}): MailMessage {
  return build(input.to, `Votre avis sur « ${input.title} »`, {
    preheader: "Une note, un mot si vous le souhaitez : deux minutes.",
    surtitre: "Votre avis",
    title: `Merci de votre présence, ${input.name}.`,
    paragraphs: [
      `Vous étiez à la rencontre « ${input.title} » le ${input.date}. Comment l’avez-vous trouvée ?`,
      "Donnez une note de 1 à 5 et, si vous le voulez, un commentaire. Votre avis n’est jamais publié : seuls les responsables du club le lisent, avec votre nom, pour améliorer les prochaines rencontres.",
    ],
    action: { label: "Donner mon avis", url: input.url },
    notes: [
      `Vous pourrez le modifier jusqu’au ${input.closesAt}.`,
      "Dans l’esprit de la charte du club : critiquer les idées, jamais les personnes.",
      ...(input.guest ? ["Ce lien vous est personnel : ne le transférez pas."] : []),
    ],
  });
}

/**
 * Rappel la veille d'une rencontre (src/features/events/reminders.ts). Le membre reçoit le lien
 * de visio (sauf s'il est masqué : carte non réglée après le délai), l'invité jamais.
 */
export function eventReminderEmail(input: {
  to: string;
  name: string;
  event: EventInfo;
  /** « demain à 18 h » ou « aujourd’hui à 18 h » (rattrapage). */
  dayAndTime: string;
  audience: "member" | "guest";
  /** Membre : la page de la rencontre ; invité : son lien personnel (voir, annuler). */
  manageUrl: string;
  videoLink: string | null;
  videoHidden: boolean;
  cardUrl: string;
  calendar: { ics: string; google: string };
  cancelBefore: string | null;
  rescheduled: boolean;
  preferencesUrl: string | null;
}): MailMessage {
  const member = input.audience === "member";
  return build(input.to, `Rappel : ${input.event.title}, ${input.dayAndTime}`, {
    preheader: `${input.event.when} · ${input.event.place}`,
    surtitre: input.rescheduled ? "Rappel · horaire modifié" : "Rappel",
    title: `À ${input.dayAndTime.startsWith("demain") ? "demain" : "tout à l’heure"} !`,
    paragraphs: [
      `Bonjour ${input.name},`,
      input.rescheduled
        ? "Attention, l’horaire de cette rencontre a changé. Nous vous attendons :"
        : "Nous vous attendons à cette rencontre :",
      input.event.title,
      `Date : ${input.event.when}`,
      `Lieu : ${input.event.place}`,
    ],
    action: {
      label: member ? "Voir la rencontre" : "Gérer mon inscription",
      url: input.manageUrl,
    },
    links: [
      ...(member && input.videoLink && !input.videoHidden
        ? [{ label: "Suivre la rencontre à distance", url: input.videoLink }]
        : []),
      { label: "Ajouter à mon agenda (fichier .ics)", url: input.calendar.ics },
      { label: "Ajouter à Google Agenda", url: input.calendar.google },
    ],
    notes: [
      input.cancelBefore
        ? `Un empêchement ? Annulez votre inscription depuis ce lien jusqu’au ${input.cancelBefore} : la place profitera à quelqu’un d’autre.`
        : "Un empêchement ? Prévenez le club dès que possible.",
      ...(member && input.videoLink && input.videoHidden
        ? [`Le lien de visio est réservé aux membres dont la carte est réglée : ${input.cardUrl}`]
        : []),
      ...(input.preferencesUrl
        ? [`Ne plus recevoir ces rappels : ${input.preferencesUrl}`]
        : input.rescheduled
          ? []
          : ["C’est le seul rappel envoyé pour cette inscription."]),
    ],
  });
}

export function contactEmail(input: {
  to: string;
  name: string;
  email: string;
  subject: string;
  message: string;
}): MailMessage & { replyTo: string } {
  const mail = build(input.to, `[Contact] ${input.subject}`, {
    preheader: `Message de ${input.name}`,
    surtitre: "Formulaire de contact",
    title: input.subject,
    paragraphs: [
      `De : ${input.name} (${input.email})`,
      ...input.message.split(/\n{2,}/).map((p) => p.replace(/\n/g, " ").trim()),
    ],
    notes: ["Répondez directement à ce message pour écrire à son auteur."],
  });
  return { ...mail, replyTo: input.email };
}
