/**
 * Les cinq activités du club et les types d'événements qui s'y rattachent.
 * Source : docs/CONTENUS-CLUB.md, section 5 (document du comité de pilotage). Ne rien y ajouter
 * qui n'y figure pas. C'est ici, et nulle part ailleurs, que vivent les libellés affichés.
 */
export const eventTypeLabels = {
  RENDEZ_VOUS_LECTURE: "Rendez-vous lecture",
  INITIATION_SCRABBLE: "Initiation au Scrabble",
  TOURNOI_SCRABBLE: "Tournoi de Scrabble",
  DEBAT_IDEES: "Débat d’idées",
  GENIES_DU_SOIR: "Génies du soir",
  AGORA_CINE: "Agora Ciné",
  LANCEMENT_AUTRE: "Vie du club",
} as const;

export type EventTypeCode = keyof typeof eventTypeLabels;
export const eventTypeCodes = Object.keys(eventTypeLabels) as [EventTypeCode, ...EventTypeCode[]];

/** Centres d'intérêt du formulaire d'adhésion (enum `Interest`) : un par activité. */
export type InterestCode = "READING" | "SCRABBLE" | "DEBATES" | "GENIES_DU_SOIR" | "AGORA_CINE";

export type Activity = {
  /** Ancre de la page Activités et valeur du filtre des archives. */
  slug: string;
  /** Lettre de la tuile. */
  letter: string;
  /** Nom officiel, avec l'article : « Les Rendez-vous lecture ». */
  name: string;
  /** Forme courte pour les filtres et les cases à cocher. */
  shortName: string;
  /** Présentation, en paragraphes. */
  paragraphs: readonly string[];
  /** Concept associé, mis en exergue (l'Invité de l'Agora). */
  feature?: { title: string; text: string };
  /** Précision de rythme propre à l'activité. */
  rhythm?: string;
  types: readonly EventTypeCode[];
  interest: InterestCode;
};

export const activities: readonly Activity[] = [
  {
    slug: "rendez-vous-lecture",
    letter: "L",
    name: "Les Rendez-vous lecture",
    shortName: "Rendez-vous lecture",
    paragraphs: [
      "Des rencontres autour d’un livre, d’une nouvelle, d’un poème ou d’un discours.",
      "Chaque participant partage son interprétation et son appréciation, pour un enrichissement mutuel.",
    ],
    types: ["RENDEZ_VOUS_LECTURE"],
    interest: "READING",
  },
  {
    slug: "tournois-de-scrabble",
    letter: "S",
    name: "Les Tournois de Scrabble",
    shortName: "Scrabble",
    paragraphs: [
      "D’abord des séances d’initiation, pour celles et ceux qui aiment le Scrabble sans avoir jamais eu l’occasion d’y jouer.",
      "Ensuite, des compétitions individuelles ou par équipes, avec un classement mensuel et des records à battre pour donner envie de se surpasser. Les gagnants sont récompensés.",
    ],
    types: ["INITIATION_SCRABBLE", "TOURNOI_SCRABBLE"],
    interest: "SCRABBLE",
  },
  {
    slug: "debats-d-idees",
    letter: "D",
    name: "Les Débats d’idées",
    shortName: "Débats d’idées",
    paragraphs: [
      "Un sujet d’actualité ou de société est choisi et débattu. Chacun a la latitude de défendre ses idées.",
      "À la fin, on repart ensemble avec une vision plus claire et une meilleure compréhension du sujet.",
    ],
    feature: {
      title: "L’Invité de l’Agora",
      text: "Sur les sujets qui demandent l’éclairage d’un expert, une personnalité est invitée, sur place ou en visioconférence.",
    },
    types: ["DEBAT_IDEES"],
    interest: "DEBATES",
  },
  {
    slug: "genies-du-soir",
    letter: "G",
    name: "Les Génies du soir",
    shortName: "Génies du soir",
    paragraphs: [
      "Quiz de culture générale, devinettes, jeux de l’esprit, concours d’éloquence et de mémorisation.",
    ],
    types: ["GENIES_DU_SOIR"],
    interest: "GENIES_DU_SOIR",
  },
  {
    slug: "agora-cine",
    letter: "C",
    name: "L’Agora Ciné",
    shortName: "Agora Ciné",
    paragraphs: [
      "La projection d’un film historique ou qui stimule l’intelligence, d’un documentaire ou d’une conférence.",
      "Elle est suivie d’un débat sur l’interprétation et l’appréciation du thème.",
    ],
    rhythm: "Tous les trois mois",
    types: ["AGORA_CINE"],
    interest: "AGORA_CINE",
  },
];

export const interestLabels: Record<InterestCode, string> = Object.fromEntries(
  activities.map((activity) => [activity.interest, activity.shortName]),
) as Record<InterestCode, string>;

export function activityBySlug(slug: string | undefined): Activity | undefined {
  return activities.find((activity) => activity.slug === slug);
}

/** Activité d'un type d'événement ; `undefined` pour « Vie du club » (lancement, autres). */
export function activityOfType(type: EventTypeCode): Activity | undefined {
  return activities.find((activity) => activity.types.includes(type));
}

/**
 * Activités d'une rencontre, prêtes à enregistrer : la principale en tête, puis les autres dans
 * l'ordre du catalogue, sans doublon. La principale est ajoutée si elle manque (la base l'exige :
 * contrainte « Event_activities_check »).
 */
export function normalizeActivities(
  primary: EventTypeCode,
  list: readonly EventTypeCode[],
): EventTypeCode[] {
  const others = eventTypeCodes.filter((code) => code !== primary && list.includes(code));
  return [primary, ...others];
}

/** Activités d'une rencontre, principale d'abord ; une liste vide (ancienne donnée) donne la principale. */
export function eventActivities(event: {
  type: EventTypeCode;
  activities?: readonly EventTypeCode[] | null;
}): EventTypeCode[] {
  return normalizeActivities(event.type, event.activities ?? []);
}

/** La rencontre relève-t-elle de cette activité du site (au moins un de ses types) ? */
export function eventHasActivity(
  event: { type: EventTypeCode; activities?: readonly EventTypeCode[] | null },
  activity: Activity,
): boolean {
  return eventActivities(event).some((code) => activity.types.includes(code));
}

/** Libellés des activités d'une rencontre, principale d'abord : « Rendez-vous lecture, Génies du soir ». */
export function activityLabels(event: {
  type: EventTypeCode;
  activities?: readonly EventTypeCode[] | null;
}): string[] {
  return eventActivities(event).map((code) => eventTypeLabels[code]);
}
