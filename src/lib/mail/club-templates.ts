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
}): MailMessage {
  return build(input.to, `Vous êtes inscrit · ${input.event.title}`, {
    preheader: `${input.event.when} · ${input.event.place}`,
    surtitre: "Inscription confirmée",
    title: "Votre place est réservée.",
    paragraphs: [`Bonjour ${input.name},`, "Nous vous attendons :", ...eventLines(input.event)],
    action: { label: "Voir mon inscription", url: input.url },
    notes: [
      input.cancelBefore
        ? `Un empêchement ? Vous pouvez annuler depuis ce lien jusqu’au ${input.cancelBefore}.`
        : "Un empêchement ? Prévenez le club dès que possible.",
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
