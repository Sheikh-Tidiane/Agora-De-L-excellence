"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWatch } from "react-hook-form";
import { StatusPill } from "@/components/admin/page-header";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { TextField, TextareaField } from "@/components/shared/form-fields";
import { useActionForm } from "@/components/shared/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/features/auth/components/form-parts";
import { saveArticleAction, setArticleStatusAction } from "@/features/articles/actions";
import {
  articleSchema,
  articleStatusLabels,
  type ArticleInput,
  type ArticleStatusCode,
} from "@/features/articles/schemas";
import { formatDateTime } from "@/lib/dates";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

export const stateLabels = {
  draft: "Brouillon",
  scheduled: "Programmé",
  published: "En ligne",
  archived: "Archivé",
} as const;
export const stateTones = {
  draft: "alerte",
  scheduled: "accent",
  published: "succes",
  archived: "neutre",
} as const;

type Existing = {
  id: string;
  slug: string;
  status: ArticleStatusCode;
  state: keyof typeof stateLabels;
  publishedAt: Date | null;
};

/** Éditeur d'article : texte en Markdown à gauche, aperçu fidèle au site à droite. */
export function ArticleEditor({
  article,
  initial,
  categories,
}: {
  article?: Existing;
  initial: ArticleInput;
  categories: string[];
}) {
  const router = useRouter();
  const { run, pending: acting, toast } = useAdminAction();
  const [tab, setTab] = useState<"write" | "preview">("write");
  const { form, pending, formError, submit } = useActionForm({
    schema: articleSchema,
    defaultValues: initial,
    action: (values) => saveArticleAction({ ...values, id: article?.id }),
    onSuccess: (saved) => {
      if (article) {
        void run(async () => ({ ok: true as const, data: undefined }), {
          success: "Article enregistré.",
        });
      } else {
        router.push(`/admin/articles/${saved.id}`);
      }
    },
  });
  const [title, category, excerpt, content] = useWatch({
    control: form.control,
    name: ["title", "category", "excerpt", "content"],
  });

  const setStatus = (
    status: ArticleStatusCode,
    success: string | ((d: { publishedAt: Date | null }) => string),
  ) =>
    article
      ? void run(() => setArticleStatusAction({ id: article.id, status }), { success })
      : undefined;

  return (
    <div>
      {/* Onglets : sous 1280 px, on écrit ou l'on relit ; au-delà, les deux côte à côte. */}
      <div
        role="tablist"
        aria-label="Affichage"
        className="mb-5 flex gap-1 border-b border-trait xl:hidden"
      >
        {(["write", "preview"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "-mb-px h-11 border-b-2 px-4 text-[0.9375rem] font-semibold",
              tab === value ? "border-indigo" : "border-transparent text-gris",
            )}
          >
            {value === "write" ? "Écrire" : "Aperçu"}
          </button>
        ))}
      </div>

      <div className="grid gap-x-12 gap-y-8 xl:grid-cols-2">
        <form
          onSubmit={submit}
          noValidate
          className={cn("flex flex-col gap-5", tab === "preview" && "max-xl:hidden")}
        >
          <FormError message={formError} />
          <TextField form={form} name="title" idPrefix="art" label="Titre" autoComplete="off" />
          <TextField
            form={form}
            name="category"
            idPrefix="art"
            label="Rubrique"
            autoComplete="off"
            list="rubriques"
            hint="Compte rendu, Mot de la semaine, Scrabble, Le livre du mois…"
          />
          <datalist id="rubriques">
            {categories.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <TextareaField
            form={form}
            name="excerpt"
            idPrefix="art"
            label="Chapô"
            rows={3}
            hint="Deux ou trois phrases. Affiché dans les listes et en tête d’article."
          />
          <TextareaField
            form={form}
            name="content"
            idPrefix="art"
            label="Texte"
            rows={18}
            inputClassName="font-mono text-[0.9375rem]"
            hint="Markdown : ligne vide entre deux paragraphes, ## pour un intertitre, **gras**, *italique*, - pour une liste, > pour une citation, [texte](https://…) pour un lien."
          />
          <TextField
            form={form}
            name="publishedAt"
            idPrefix="art"
            label="Date de publication"
            optional
            type="datetime-local"
            hint="Heure de Dakar. Une date à venir programme la publication ; vide : à l’instant où vous publiez."
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-trait pt-5">
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : article ? "Enregistrer" : "Créer le brouillon"}
            </Button>
            {article?.status === "DRAFT" ? (
              <Button
                variant="action"
                disabled={acting || pending}
                onClick={() =>
                  setStatus("PUBLISHED", (data) =>
                    data.publishedAt && data.publishedAt.getTime() > Date.now()
                      ? `Publication programmée le ${formatDateTime(data.publishedAt)}.`
                      : "Article publié : il est en ligne.",
                  )
                }
              >
                Publier
              </Button>
            ) : null}
            {article?.status === "PUBLISHED" ? (
              <>
                <Button
                  variant="contour"
                  disabled={acting}
                  onClick={() => setStatus("DRAFT", "Article repassé en brouillon.")}
                >
                  Dépublier
                </Button>
                <Button
                  variant="contour"
                  disabled={acting}
                  onClick={() => setStatus("ARCHIVED", "Article archivé : il n’est plus en ligne.")}
                >
                  Archiver
                </Button>
              </>
            ) : null}
            {article?.status === "ARCHIVED" ? (
              <Button
                variant="contour"
                disabled={acting}
                onClick={() => setStatus("DRAFT", "Article restauré en brouillon.")}
              >
                Restaurer en brouillon
              </Button>
            ) : null}
          </div>
          {article ? (
            <p className="petit flex flex-wrap items-center gap-2 text-gris">
              <StatusPill tone={stateTones[article.state]}>{stateLabels[article.state]}</StatusPill>
              {/* Le statut n'est répété que s'il dit autre chose que la pastille (« Programmé »). */}
              <span>
                {[
                  articleStatusLabels[article.status] === stateLabels[article.state]
                    ? null
                    : articleStatusLabels[article.status],
                  article.publishedAt ? formatDateTime(article.publishedAt) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {article.state === "published" ? (
                <a href={`/news/${article.slug}`} target="_blank" rel="noreferrer" className="lien">
                  Voir en ligne
                </a>
              ) : null}
            </p>
          ) : (
            <p className="petit text-gris">
              Enregistrez d’abord le brouillon : vous pourrez ensuite le publier.
            </p>
          )}
        </form>

        {/* Aperçu : mêmes styles que la page publique. */}
        <section
          aria-label="Aperçu"
          className={cn(
            "rounded-feuille bg-blanc p-6 lg:p-9 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-8rem)] xl:self-start xl:overflow-y-auto",
            tab === "write" && "max-xl:hidden",
          )}
        >
          <p className="surtitre">{category || "Rubrique"}</p>
          <p className="mt-3 font-serif text-[2rem] leading-[1.06] tracking-[-0.01em] lg:text-[2.75rem]">
            {title || "Titre de l’article"}
          </p>
          {excerpt ? (
            <p className="mt-5 font-serif text-[1.25rem] leading-[1.4]">{excerpt}</p>
          ) : null}
          <div className="mt-6">
            {content ? (
              <Markdown source={content} lettrine />
            ) : (
              <p className="text-gris">L’aperçu du texte s’affiche ici pendant que vous écrivez.</p>
            )}
          </div>
        </section>
      </div>
      {toast}
    </div>
  );
}
