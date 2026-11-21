import { z } from "zod";

/** Requêtes du scan des présences (Route Handlers), validées côté serveur. */
const id = z.string().min(1).max(40);

export const scanRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("token"),
    eventId: id,
    /** Jeton de carte : environ 45 caractères ; la signature est vérifiée par le service. */
    token: z.string().trim().min(1, "Saisissez le code de la carte.").max(200),
    paid: z.boolean(),
  }),
  z.object({ mode: z.literal("member"), eventId: id, userId: id, paid: z.boolean() }),
]);

export const searchRequestSchema = z.object({
  eventId: id,
  q: z.string().trim().min(2, "Au moins deux caractères.").max(60),
});
