import { z } from "zod";
import {
  ASSISTANT_MODE_IDS,
  MAX_ANSWER_CHARS,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_CHARS,
} from "@/features/assistant/modes";

/**
 * Requête envoyée à `POST /api/assistant` (mêmes règles côté client et serveur).
 * L'historique vient du navigateur : il est borné et ne fait jamais autorité (voir prompt.ts).
 */
const userMessage = z.object({
  role: z.literal("user"),
  content: z
    .string()
    .trim()
    .min(1, "La question est vide.")
    .max(MAX_MESSAGE_CHARS, `La question dépasse ${MAX_MESSAGE_CHARS} caractères.`),
});

const assistantMessage = z.object({
  role: z.literal("assistant"),
  content: z
    .string()
    .trim()
    .min(1, "Une réponse vide ne peut pas figurer dans l’historique.")
    .max(MAX_ANSWER_CHARS, "Une réponse de l’historique est trop longue."),
});

export const assistantMessageSchema = z.discriminatedUnion("role", [userMessage, assistantMessage]);

export const assistantRequestSchema = z.object({
  mode: z.enum(ASSISTANT_MODE_IDS, { error: "Mode inconnu." }),
  messages: z
    .array(assistantMessageSchema)
    .min(1, "Posez une question.")
    .max(MAX_HISTORY_MESSAGES, "La conversation est trop longue : recommencez-en une.")
    .refine((list) => list[0]?.role === "user", "La conversation doit commencer par une question.")
    .refine(
      (list) => list[list.length - 1]?.role === "user",
      "Le dernier message doit être une question.",
    ),
});

export type AssistantMessage = z.infer<typeof assistantMessageSchema>;
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
