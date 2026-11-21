import "server-only";
import { CATALOG_MAX_BOOKS, type CatalogEntry } from "@/features/assistant/prompt";
import { readQuota } from "@/features/assistant/quota";
import { env } from "@/lib/env";
import { isLLMConfigured } from "@/lib/llm";
import { prisma } from "@/lib/prisma";

export type AssistantStatus = {
  /** Faux sans clé d'API : l'interface affiche « Assistant non connecté ». */
  connected: boolean;
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  /** Minuit suivant, heure de Dakar : retour du quota. */
  resetsAt: Date;
};

/** État de l'assistant pour un membre, sans appeler le modèle. */
export async function getAssistantStatus(
  userId: string,
  now: Date = new Date(),
): Promise<AssistantStatus> {
  const dailyLimit = env.ASSISTANT_DAILY_LIMIT;
  const usage = await readQuota(userId, dailyLimit, now);
  return {
    connected: isLLMConfigured(),
    dailyLimit,
    usedToday: usage.used,
    remaining: usage.remaining,
    resetsAt: usage.resetsAt,
  };
}

/**
 * Livres publiés du catalogue, réduits au titre, aux auteurs et à la catégorie. Les coups de cœur du
 * club d'abord, puis l'ordre alphabétique ; au plus `CATALOG_MAX_BOOKS` livres.
 */
export async function loadAssistantCatalog(): Promise<CatalogEntry[]> {
  const books = await prisma.book.findMany({
    where: { isPublished: true, archivedAt: null },
    orderBy: [{ isClubFavorite: "desc" }, { title: "asc" }],
    take: CATALOG_MAX_BOOKS,
    select: {
      title: true,
      authors: { select: { name: true }, orderBy: { name: "asc" } },
      category: { select: { name: true } },
    },
  });
  return books.map((book) => ({
    title: book.title,
    authors: book.authors.map((author) => author.name),
    category: book.category.name,
  }));
}
