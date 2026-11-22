import { z } from "zod";
import { isStoredImage } from "@/lib/storage-names";

/** Comité de pilotage : types et schéma partagés entre le formulaire (client) et le service. */
export type CommitteeMemberView = {
  id: string;
  name: string;
  role: string | null;
  photo: string | null;
  bio: string | null;
  position: number;
};

const text = (max: number) => z.string().trim().max(max, `Pas plus de ${max} caractères.`);

export const committeeMemberSchema = z.object({
  id: z.string().max(40),
  name: text(80).min(2, "Indiquez le nom."),
  role: text(80),
  bio: text(600),
  /** Nom d'une image téléversée par /api/admin/uploads (`committee/…`), ou vide. */
  photo: text(80).refine((value) => value === "" || isStoredImage(value), {
    message: "Photo invalide.",
  }),
});
export type CommitteeMemberInput = z.input<typeof committeeMemberSchema>;

/** Initiales pour l'avatar typographique : « Yaye Arête Sagna Diop » → « YD ». */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : "";
  return (first + last).toLocaleUpperCase("fr");
}
