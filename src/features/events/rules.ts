/** Règles d'inscription aux rencontres (docs/REGLES-METIER.md). Fonctions pures, testées sans base. */
import { eventTypeCodes, eventTypeLabels, type EventTypeCode } from "@/config/activities";

/** Libellés des types : définis dans la configuration des activités, réexportés ici. */
export { eventTypeCodes, eventTypeLabels, type EventTypeCode };

/** Lieu affiché : tant qu'il n'est pas fixé, « Lieu à confirmer ». */
export const placeLabel = (location: string | null | undefined) => location || "Lieu à confirmer";

export const eventStatusLabels = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publié",
  CLOSED: "Clôturé",
  CANCELLED: "Annulé",
} as const;
export type EventStatusCode = keyof typeof eventStatusLabels;

/** Un invité a ce délai pour confirmer par e-mail ; au-delà, sa place est remise à disposition. */
export const GUEST_HOLD_HOURS = 24;
const HOUR = 60 * 60 * 1000;

export type EventForRules = {
  status: EventStatusCode;
  startsAt: Date;
  capacity: number | null;
  isPublic: boolean;
  cancellationDeadlineHours: number | null;
};

export type RegistrationWindow = "open" | "past" | "closed" | "cancelled" | "unpublished";

/** Peut-on encore s'inscrire ? Les inscriptions ferment au début de la rencontre. */
export function registrationWindow(
  event: Pick<EventForRules, "status" | "startsAt">,
  now: Date,
): RegistrationWindow {
  if (event.status === "CANCELLED") return "cancelled";
  if (event.status === "DRAFT") return "unpublished";
  if (event.startsAt.getTime() <= now.getTime()) return "past";
  if (event.status === "CLOSED") return "closed";
  return "open";
}

/** Places restantes ; `null` quand la rencontre n'a pas de limite. Jamais négatif. */
export function seatsLeft(capacity: number | null, taken: number): number | null {
  return capacity === null ? null : Math.max(0, capacity - taken);
}

/** Dernier moment pour annuler : X heures avant le début (réglage de l'événement, sinon celui du club). */
export function cancellationDeadline(
  event: Pick<EventForRules, "startsAt" | "cancellationDeadlineHours">,
  defaultHours: number,
): Date {
  const hours = event.cancellationDeadlineHours ?? defaultHours;
  return new Date(event.startsAt.getTime() - hours * HOUR);
}

export function canCancel(
  event: Pick<EventForRules, "status" | "startsAt" | "cancellationDeadlineHours">,
  now: Date,
  defaultHours: number,
): boolean {
  if (event.status === "CANCELLED") return false;
  return now.getTime() <= cancellationDeadline(event, defaultHours).getTime();
}

/** Une inscription invitée non confirmée ne retient sa place que pendant `GUEST_HOLD_HOURS`. */
export function holdsSeat(
  registration: { status: "PENDING" | "CONFIRMED" | "CANCELLED"; updatedAt: Date },
  now: Date,
): boolean {
  if (registration.status === "CONFIRMED") return true;
  if (registration.status === "CANCELLED") return false;
  return now.getTime() - registration.updatedAt.getTime() < GUEST_HOLD_HOURS * HOUR;
}

/** Début de la fenêtre pendant laquelle une inscription en attente retient encore une place. */
export function holdCutoff(now: Date): Date {
  return new Date(now.getTime() - GUEST_HOLD_HOURS * HOUR);
}

export type RegistrationRefusal = "FULL" | "PAST" | "CLOSED" | "CANCELLED" | "MEMBERS_ONLY";

/** Décision d'inscription. `null` : l'inscription est permise. */
export function refuseRegistration(
  event: EventForRules,
  taken: number,
  now: Date,
  kind: "member" | "guest",
): RegistrationRefusal | null {
  const window = registrationWindow(event, now);
  if (window === "cancelled" || window === "unpublished") return "CANCELLED";
  if (window === "past") return "PAST";
  if (window === "closed") return "CLOSED";
  if (kind === "guest" && !event.isPublic) return "MEMBERS_ONLY";
  if (seatsLeft(event.capacity, taken) === 0) return "FULL";
  return null;
}

export const refusalMessages: Record<RegistrationRefusal, string> = {
  FULL: "Cette rencontre est complète.",
  PAST: "Cette rencontre a déjà commencé : les inscriptions sont closes.",
  CLOSED: "Les inscriptions à cette rencontre sont closes.",
  CANCELLED: "Cette rencontre n’est pas ouverte aux inscriptions.",
  MEMBERS_ONLY: "Cette rencontre est réservée aux membres du club.",
};

/** Déroulé d'une rencontre : une étape par ligne, « horaire | intitulé ». Les lignes vides sont ignorées. */
export function parseProgram(
  program: string | null | undefined,
): { time: string; label: string }[] {
  if (!program) return [];
  return program
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cut = line.indexOf("|");
      return cut === -1
        ? { time: "", label: line }
        : { time: line.slice(0, cut).trim(), label: line.slice(cut + 1).trim() };
    })
    .filter((step) => step.label.length > 0);
}
