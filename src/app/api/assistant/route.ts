import { NextResponse } from "next/server";
import { buildSystemBlocks, MODES_WITH_CATALOG } from "@/features/assistant/prompt";
import { loadAssistantCatalog } from "@/features/assistant/queries";
import { refundQuestion, reserveQuestion } from "@/features/assistant/quota";
import { assistantRequestSchema } from "@/features/assistant/schemas";
import { startAssistantStream } from "@/features/assistant/service";
import { env } from "@/lib/env";
import { AppError, zodFieldErrors } from "@/lib/errors";
import { getLLMProvider } from "@/lib/llm";
import { logger } from "@/lib/logger";
import { requirePermission } from "@/lib/permissions";
import { consumeRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/same-origin";

/**
 * Question au « Compagnon des Lettres » (docs/DECISIONS.md §14). Ordre : assistant configuré (sinon
 * 404 : il n'existe pas), session et permission `member.access`, Zod, limite de débit, quota du
 * jour, puis appel au modèle.
 * Succès : texte brut diffusé au fil de l'eau. Jamais de contenu de conversation dans les journaux.
 */
const NO_STORE = { "Cache-Control": "no-store" };

function json(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export async function POST(request: Request) {
  // Non configuré (clé ou modèle absent, voir isAssistantEnabled) : la route n'existe pas.
  const provider = getLLMProvider();
  if (!provider) return json(404, { error: "Page introuvable.", code: "NOT_FOUND" });
  try {
    const user = await requirePermission("member.access");
    assertSameOrigin(request);

    const raw: unknown = await request.json().catch(() => undefined);
    const parsed = assistantRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return json(400, {
        error: "La demande envoyée à l’assistant est invalide.",
        fieldErrors: zodFieldErrors(parsed.error),
      });
    }
    const { mode, messages } = parsed.data;

    const burst = await consumeRateLimit("assistant.ask.user", user.id);
    if (!burst.allowed) {
      return json(
        429,
        {
          error: "Vous posez vos questions très vite : patientez une minute avant la suivante.",
          code: "RATE_LIMIT",
          resetAt: new Date(Date.now() + burst.retryAfter * 1000).toISOString(),
        },
        { "Retry-After": String(burst.retryAfter) },
      );
    }

    const quota = await reserveQuestion(user.id, env.ASSISTANT_DAILY_LIMIT);
    if (!quota.allowed) {
      return json(
        429,
        {
          error: `Vous avez posé vos ${env.ASSISTANT_DAILY_LIMIT} questions du jour. Le Compagnon vous retrouve demain.`,
          code: "QUOTA",
          resetAt: quota.resetsAt.toISOString(),
        },
        { "X-Assistant-Remaining": "0" },
      );
    }

    // À partir d'ici, la question est réservée : toute sortie sans réponse la rend.
    let started;
    try {
      const catalog = MODES_WITH_CATALOG.includes(mode) ? await loadAssistantCatalog() : null;
      started = await startAssistantStream({
        provider,
        system: buildSystemBlocks(mode, catalog),
        messages,
        signal: request.signal,
        onFinish: (outcome) => {
          if (outcome.kind === "completed") {
            const { result } = outcome;
            logger.info("Réponse de l’assistant", {
              mode,
              stopReason: result.stopReason,
              model: result.model,
              inputTokens: result.usage.inputTokens,
              outputTokens: result.usage.outputTokens,
              cacheReadTokens: result.usage.cacheReadTokens,
              cacheWriteTokens: result.usage.cacheWriteTokens,
            });
          } else if (outcome.kind === "interrupted") {
            logger.warn("Réponse de l’assistant interrompue", {
              mode,
              kind: outcome.error.kind,
              status: outcome.error.status,
            });
          }
        },
      });
    } catch (error) {
      await refundQuestion(user.id, quota.day).catch(() => undefined);
      throw error;
    }

    if (!started.ok) {
      // Annulée par le membre avant le premier mot : la question reste comptée (le modèle a déjà
      // lu la demande et réfléchi, et un « Arrêter » répété ne doit pas contourner le quota).
      if (started.error.kind === "aborted") {
        return json(
          499,
          { error: "Question annulée.", code: "CANCELLED" },
          { "X-Assistant-Remaining": String(quota.remaining) },
        );
      }
      await refundQuestion(user.id, quota.day).catch((error: unknown) =>
        logger.error("Quota de l’assistant non rendu", error),
      );
      const remaining = String(quota.remaining + 1);
      logger.warn("Fournisseur de l’assistant en échec", {
        mode,
        kind: started.error.kind,
        status: started.error.status,
      });
      return json(
        502,
        {
          error:
            started.error.kind === "rate_limit" || started.error.kind === "overloaded"
              ? "L’assistant est très sollicité en ce moment. Réessayez dans quelques instants."
              : "L’assistant ne répond pas pour le moment. Réessayez dans quelques instants.",
          code: "UPSTREAM",
        },
        { "X-Assistant-Remaining": remaining },
      );
    }

    return new Response(started.body, {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        // Pas de mise en mémoire tampon par un proxy (nginx) : le texte doit arriver au fil de l'eau.
        "X-Accel-Buffering": "no",
        "X-Assistant-Remaining": String(quota.remaining),
      },
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHENTICATED") {
      return json(401, { error: error.message, code: error.code });
    }
    if (error instanceof AppError && error.code === "FORBIDDEN") {
      return json(403, { error: error.message, code: error.code });
    }
    logger.error("Erreur inattendue (assistant)", error);
    return json(500, {
      error: "Un contretemps de notre côté. Réessayez dans un instant.",
      code: "INTERNAL",
    });
  }
}
