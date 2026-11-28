import type { PublicEvent } from "@/features/events/queries";
import { placeLabel } from "@/features/events/rules";
import { formatFullDate, formatTime } from "@/lib/dates";

/**
 * Partage d'une rencontre (WhatsApp, partage natif du téléphone) : un message court, construit
 * côté serveur. Seules des informations publiques : jamais le lien de visio (absent du type).
 */
export type ShareSource = Pick<
  PublicEvent,
  "slug" | "title" | "startsAt" | "location" | "isTentative"
>;

const MAX_TITLE = 120;

export const eventUrl = (event: Pick<ShareSource, "slug">, appUrl: string) =>
  `${appUrl}/events/${event.slug}`;

const shortTitle = (title: string) =>
  title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1).trimEnd()}…` : title;

/** « Titre » puis « samedi 5 décembre 2026 à 18 h · Lieu » (sans l'adresse de la page). */
export function shareText(event: ShareSource): string {
  const when = `${formatFullDate(event.startsAt)} à ${formatTime(event.startsAt)}`;
  const tentative = event.isTentative ? " (date provisoire)" : "";
  return `${shortTitle(event.title)}\n${when}${tentative} · ${placeLabel(event.location)}`;
}

/** Message WhatsApp : le texte, puis l'adresse de la page en dernier (WhatsApp en tire l'aperçu). */
export function whatsappMessage(event: ShareSource, appUrl: string): string {
  return `${shareText(event)}\n${eventUrl(event, appUrl)}`;
}

/** Lien wa.me : `encodeURIComponent` (et non URLSearchParams, qui change les espaces en « + »). */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Données du partage natif (`navigator.share`). */
export function shareData(event: ShareSource, appUrl: string) {
  return { title: shortTitle(event.title), text: shareText(event), url: eventUrl(event, appUrl) };
}
