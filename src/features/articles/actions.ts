"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { articleSchema, articleStatusSchema, type ArticleInput } from "@/features/articles/schemas";
import { saveArticle, setArticleStatus } from "@/features/articles/service";
import { cacheTags } from "@/lib/cache-tags";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

/** Gestion des articles. Chaque action exige `articles.manage` et rafraîchit le site public. */
/** Identifiant facultatif d'un enregistrement : absent ou vide = création. Toujours validé. */
const optionalIdSchema = z.object({ id: z.string().max(40).optional() });

export async function saveArticleAction(
  input: ArticleInput & { id?: string },
): Promise<ActionResult<{ id: string }>> {
  return runAction("articles.save", async () => {
    const actor = await requirePermission("articles.manage");
    const data = parseInput(articleSchema, input);
    const id = parseInput(optionalIdSchema, input).id || null;
    const saved = await saveArticle(id, data, actor.id);
    updateTag(cacheTags.articles);
    return saved;
  });
}

export async function setArticleStatusAction(input: {
  id: string;
  status: string;
}): Promise<ActionResult<{ publishedAt: Date | null }>> {
  return runAction("articles.setStatus", async () => {
    await requirePermission("articles.manage");
    const { id, status } = parseInput(articleStatusSchema, input);
    const result = await setArticleStatus(id, status);
    updateTag(cacheTags.articles);
    return result;
  });
}
