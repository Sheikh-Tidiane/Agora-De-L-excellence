import { z } from "zod";

/** Charte du club : type, texte provisoire et schéma, partagés entre le formulaire et le service. */
export type Charter = {
  /** Texte en Markdown. */
  content: string;
  version: number;
  /** Vrai tant que le comité n'a pas validé le texte définitif. */
  provisional: boolean;
  updatedAt: Date | null;
};

/**
 * Version provisoire : les principes retenus par le comité (docs/CONTENUS-CLUB.md, section 8 bis),
 * en attente du texte définitif.
 */
export const defaultCharter: Charter = {
  content: [
    "- Respecter les opinions des autres.",
    "- Éviter les interruptions et les attaques personnelles.",
    "- Respecter les horaires.",
    "- Encourager les débutants.",
    "- Favoriser la participation de tous.",
    "- Préserver un environnement convivial et bienveillant.",
    "- Rester respectueux dans les critiques et commentaires publiés sur la plateforme.",
    "- Ne publier aucune photo ou vidéo d’un membre sans son accord.",
    "- Régler sa carte de membre et sa participation aux séances.",
  ].join("\n"),
  version: 1,
  provisional: true,
  updatedAt: null,
};

export const charterSchema = z.object({
  content: z
    .string()
    .trim()
    .min(20, "La charte ne peut pas être vide.")
    .max(20_000, "Pas plus de 20 000 caractères."),
  provisional: z.boolean(),
});
export type CharterInput = z.input<typeof charterSchema>;
