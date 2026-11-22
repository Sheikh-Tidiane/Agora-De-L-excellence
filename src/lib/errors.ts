import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { logger } from "@/lib/logger";

/**
 * Gestion centralisée des erreurs.
 * - Les services lèvent des `AppError` (erreurs attendues, avec un message destiné à l'utilisateur).
 * - Les Server Actions passent par `runAction`, qui renvoie toujours un `ActionResult` typé.
 * - Toute autre erreur est journalisée (sans donnée privée) et remplacée par un message générique.
 */
export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INVALID_CREDENTIALS"
  | "INVALID_TOKEN"
  | "INTERNAL";

const defaultMessages: Record<ErrorCode, string> = {
  VALIDATION: "Certains champs sont à corriger.",
  UNAUTHENTICATED: "Connectez-vous pour continuer.",
  FORBIDDEN: "Vous n’avez pas accès à cette action.",
  NOT_FOUND: "Élément introuvable.",
  CONFLICT: "Cette opération est en conflit avec l’état actuel.",
  RATE_LIMITED: "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
  INVALID_CREDENTIALS: "Adresse e-mail ou mot de passe incorrect.",
  INVALID_TOKEN: "Ce lien n’est plus valable.",
  INTERNAL: "Un contretemps de notre côté. Réessayez dans un instant.",
};

export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: FieldErrors;
  /** Secondes à attendre avant de réessayer (limitation de débit). */
  readonly retryAfter?: number;

  constructor(
    code: ErrorCode,
    message?: string,
    options?: { fieldErrors?: FieldErrors; retryAfter?: number; cause?: unknown },
  ) {
    super(message ?? defaultMessages[code], { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = options?.fieldErrors;
    this.retryAfter = options?.retryAfter;
  }
}

export type ActionFailure = {
  ok: false;
  code: ErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
  retryAfter?: number;
};
export type ActionResult<T = undefined> = { ok: true; data: T } | ActionFailure;

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

/** Première erreur de chaque champ d'une `ZodError`, indexée par chemin (`a.b`). */
export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  return fields;
}

/** Valide une entrée côté serveur ; lève une `AppError` VALIDATION avec le détail par champ. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError("VALIDATION", undefined, { fieldErrors: zodFieldErrors(result.error) });
  }
  return result.data;
}

/** Convertit n'importe quelle erreur en échec typé. Les erreurs inattendues sont journalisées. */
export function toFailure(error: unknown, context: string): ActionFailure {
  if (error instanceof AppError) {
    return {
      ok: false,
      code: error.code,
      message: error.message,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
    };
  }
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      code: "VALIDATION",
      message: defaultMessages.VALIDATION,
      fieldErrors: zodFieldErrors(error),
    };
  }
  logger.error(`Erreur inattendue (${context})`, error);
  return { ok: false, code: "INTERNAL", message: defaultMessages.INTERNAL };
}

/**
 * Enveloppe d'une Server Action : exécute `fn`, renvoie un résultat typé.
 * Les signaux de Next.js (`redirect`, `notFound`) sont relancés tels quels.
 */
export async function runAction<T>(
  context: string,
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    unstable_rethrow(error);
    return toFailure(error, context);
  }
}
