import { site } from "@/config/site";
import type { MailMessage } from "@/lib/mail";

/**
 * Gabarits d'e-mails à l'identité du club : ivoire, indigo, terracotta, tuile A1.
 * Mise en page en tableaux et styles en ligne (seule approche fiable dans les messageries),
 * polices de repli proches de Young Serif et Work Sans, sans image distante bloquante.
 */
const couleurs = {
  indigo: "#1F2A55",
  terracotta: "#C2562E",
  terracottaFonce: "#A9471F",
  ivoire: "#F7F4ED",
  trait: "#E4DDCC",
  gris: "#5E6478",
  blanc: "#FFFFFF",
};
const serif = "Georgia, 'Times New Roman', serif";
const sans = "'Work Sans', 'Segoe UI', Helvetica, Arial, sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type Layout = {
  /** Résumé affiché par la messagerie à côté de l'objet. */
  preheader: string;
  surtitre: string;
  title: string;
  paragraphs: string[];
  /** Bouton principal. Absent pour un simple accusé de réception. */
  action?: { label: string; url: string };
  /** Précisions sous le bouton (durée de validité, quoi faire si l'on n'est pas concerné). */
  notes: string[];
};

function renderHtml({ preheader, surtitre, title, paragraphs, action, notes }: Layout): string {
  const url = action ? escapeHtml(action.url) : "";
  const button = action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 22px;"><tr>
      <td style="background:${couleurs.terracottaFonce};border-radius:10px;">
        <a href="${url}" style="display:inline-block;padding:15px 26px;font-family:${sans};font-size:16px;font-weight:600;color:${couleurs.blanc};text-decoration:none;">${escapeHtml(action.label)}</a>
      </td>
    </tr></table>`
    : `<div style="height:8px;"></div>`;
  const fallback = action
    ? `<p style="margin:18px 0 0;padding-top:16px;border-top:1px solid ${couleurs.trait};font-family:${sans};font-size:13px;line-height:1.5;color:${couleurs.gris};">Si le bouton ne répond pas, copiez cette adresse dans votre navigateur&nbsp;:<br><a href="${url}" style="color:${couleurs.terracottaFonce};word-break:break-all;">${url}</a></p>`
    : "";
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${couleurs.ivoire};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${couleurs.ivoire};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="padding:0 4px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="width:44px;height:44px;background:${couleurs.indigo};border-radius:7px;text-align:center;vertical-align:middle;font-family:${serif};font-size:26px;line-height:44px;color:${couleurs.ivoire};">A</td>
      <td style="padding-left:12px;vertical-align:middle;">
        <div style="font-family:${serif};font-size:22px;line-height:1.1;color:${couleurs.indigo};">${escapeHtml(site.shortName)}</div>
        <div style="font-family:${sans};font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${couleurs.terracottaFonce};padding-top:3px;">${escapeHtml(site.name.replace(site.shortName, "").trim())}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="background:${couleurs.blanc};border-radius:16px;padding:36px 28px 32px;border-top:4px solid ${couleurs.terracotta};">
    <div style="font-family:${sans};font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${couleurs.terracottaFonce};">${escapeHtml(surtitre)}</div>
    <h1 style="margin:10px 0 18px;font-family:${serif};font-weight:400;font-size:30px;line-height:1.12;color:${couleurs.indigo};">${escapeHtml(title)}</h1>
    ${paragraphs
      .map(
        (p) =>
          `<p style="margin:0 0 14px;font-family:${sans};font-size:16px;line-height:1.6;color:${couleurs.indigo};">${escapeHtml(p)}</p>`,
      )
      .join("\n    ")}
    ${button}
    ${notes
      .map(
        (n) =>
          `<p style="margin:0 0 10px;font-family:${sans};font-size:14px;line-height:1.5;color:${couleurs.gris};">${escapeHtml(n)}</p>`,
      )
      .join("\n    ")}
    ${fallback}
  </td></tr>
  <tr><td style="padding:22px 4px 0;font-family:${sans};font-size:13px;line-height:1.5;color:${couleurs.gris};">
    ${escapeHtml(site.name)} · ${escapeHtml(site.baseline)} à ${escapeHtml(site.city)}<br>
    Message envoyé automatiquement, merci de ne pas y répondre.
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function renderText({ title, paragraphs, action, notes }: Layout): string {
  return [
    title,
    "",
    ...paragraphs,
    "",
    ...(action ? [`${action.label} : ${action.url}`, ""] : []),
    ...notes,
    "",
    `${site.name} · ${site.baseline} à ${site.city}`,
  ].join("\n");
}

export function build(to: string, subject: string, layout: Layout): MailMessage {
  return { to, subject, html: renderHtml(layout), text: renderText(layout) };
}

export function activationEmail(input: {
  to: string;
  firstName: string;
  url: string;
  validDays: number;
}): MailMessage {
  return build(input.to, `Activez votre compte · ${site.name}`, {
    preheader: "Choisissez votre mot de passe pour entrer dans l’espace membre.",
    surtitre: "Bienvenue au club",
    title: `${input.firstName}, votre place est prête.`,
    paragraphs: [
      `Votre compte à ${site.name} vient d’être créé. Il reste une étape : choisir votre mot de passe.`,
    ],
    action: { label: "Activer mon compte", url: input.url },
    notes: [
      `Ce lien est personnel et reste valable ${input.validDays} jours. Il ne peut servir qu’une fois.`,
      "Vous n’attendiez pas ce message ? Ignorez-le : sans mot de passe, le compte reste inactif.",
    ],
  });
}

export function resetPasswordEmail(input: {
  to: string;
  firstName: string;
  url: string;
  validMinutes: number;
}): MailMessage {
  return build(input.to, `Votre nouveau mot de passe · ${site.name}`, {
    preheader: "Un lien pour choisir un nouveau mot de passe.",
    surtitre: "Mot de passe oublié",
    title: "Choisissez un nouveau mot de passe.",
    paragraphs: [
      `Bonjour ${input.firstName},`,
      `Quelqu’un, vous sans doute, a demandé à réinitialiser le mot de passe de votre compte à ${site.name}.`,
    ],
    action: { label: "Choisir un nouveau mot de passe", url: input.url },
    notes: [
      `Ce lien reste valable ${input.validMinutes} minutes et ne peut servir qu’une fois.`,
      "Vous n’avez rien demandé ? Ignorez ce message : votre mot de passe actuel reste inchangé.",
    ],
  });
}
