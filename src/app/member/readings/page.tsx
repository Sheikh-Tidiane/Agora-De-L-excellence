import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { BookCover } from "@/components/shared/book-cover";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { authRoutes } from "@/config/auth";
import { CompletionTag, ProgressBar } from "@/features/readings/components/reading-pills";
import { getMyReadings } from "@/features/readings/queries";
import { readingStatusLabels } from "@/features/readings/schemas";
import { formatDate } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mes lectures" };

const views = [
  { key: "en-cours", label: "En cours", match: (r: Row) => r.status === "READING" },
  { key: "a-lire", label: "À lire", match: (r: Row) => r.status === "TO_READ" },
  { key: "termines", label: "Terminés", match: (r: Row) => r.status === "FINISHED" },
  { key: "favoris", label: "Favoris", match: (r: Row) => r.isFavorite },
] as const;
type Row = Awaited<ReturnType<typeof getMyReadings>>[number];
type ViewKey = (typeof views)[number]["key"];

async function Readings({
  searchParams,
}: {
  searchParams: PageProps<"/member/readings">["searchParams"];
}) {
  const user = await requirePageAccess("member.access", `${authRoutes.member}/readings`);
  const [{ vue }, readings] = await Promise.all([searchParams, getMyReadings(user.id)]);
  const counts = Object.fromEntries(views.map((v) => [v.key, readings.filter(v.match).length]));
  // Vue par défaut : la première qui contient quelque chose.
  const asked = views.find((v) => v.key === vue);
  const current: ViewKey = asked?.key ?? views.find((v) => counts[v.key]! > 0)?.key ?? "en-cours";
  const view = views.find((v) => v.key === current)!;
  const shown = readings.filter(view.match);

  if (readings.length === 0) {
    return (
      <EmptyState
        title="Votre étagère est vide"
        className="pt-6"
        action={
          <Link href="/library" className={buttonVariants({ variant: "principal" })}>
            Parcourir la bibliothèque
            <ArrowRight aria-hidden="true" />
          </Link>
        }
      >
        Ajoutez un livre du catalogue depuis sa fiche : vous suivrez votre progression, garderez vos
        notes et, une fois terminé, le club pourra valider votre lecture.
      </EmptyState>
    );
  }

  return (
    <>
      <nav
        aria-label="Filtrer mes lectures"
        className="-mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        <ul className="flex gap-2">
          {views.map((v) => (
            <li key={v.key}>
              <Link
                href={`/member/readings?vue=${v.key}`}
                aria-current={v.key === current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[0.9375rem] font-semibold whitespace-nowrap transition-colors",
                  v.key === current
                    ? "border-indigo bg-indigo text-ivoire"
                    : "border-indigo/20 text-indigo hover:border-indigo",
                )}
              >
                {v.label}
                <span className="tabular-nums opacity-70">{counts[v.key]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {shown.length === 0 ? (
        <p className="mt-8 border-t border-indigo/20 pt-6 text-gris">
          Rien dans « {view.label} » pour l’instant.
        </p>
      ) : (
        <ul className="mt-8 grid gap-x-10 border-b border-indigo/20 md:grid-cols-2">
          {shown.map((reading) => {
            const author = reading.book.authors.map((a) => a.name).join(", ");
            return (
              <li key={reading.id} className="border-t border-indigo/20">
                <Link
                  href={`/member/readings/${reading.id}`}
                  className="group grid grid-cols-[72px_1fr] gap-4 py-5"
                >
                  <BookCover
                    title={reading.book.title}
                    author={author}
                    category={reading.book.category.name}
                    image={reading.book.coverImage}
                    sizes="72px"
                    className="w-[72px]"
                  />
                  <div className="min-w-0">
                    <p className="petit flex items-center gap-1.5 font-semibold text-gris">
                      {readingStatusLabels[reading.status]}
                      {reading.isFavorite ? (
                        <Heart
                          aria-label="Favori"
                          className="size-3.5 fill-terracotta text-terracotta"
                        />
                      ) : null}
                    </p>
                    <h2 className="mt-0.5 font-serif text-lg leading-snug decoration-terracotta underline-offset-4 group-hover:underline">
                      {reading.book.title}
                    </h2>
                    <p className="petit text-gris">{author}</p>
                    <div className="mt-3">
                      {reading.status === "READING" ? (
                        <ProgressBar
                          value={reading.progress}
                          label={`Progression de ${reading.book.title}`}
                        />
                      ) : reading.status === "FINISHED" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {reading.finishedAt ? (
                            <span className="petit text-gris">
                              Terminé le {formatDate(reading.finishedAt)}
                            </span>
                          ) : null}
                          <CompletionTag status={reading.completionStatus} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/library" className="lien mt-6 inline-flex min-h-11 items-center gap-1">
        Ajouter un livre depuis la bibliothèque
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </>
  );
}

export default function ReadingsPage({ searchParams }: PageProps<"/member/readings">) {
  return (
    <>
      <p className="surtitre">Lectures</p>
      <h1 className="titre-1 mt-3">Mes lectures</h1>
      <Suspense
        fallback={
          <div aria-hidden="true" className="mt-8 space-y-4">
            <div className="skeleton h-11 w-72" />
            <div className="skeleton h-28 w-full" />
            <div className="skeleton h-28 w-full" />
          </div>
        }
      >
        <Readings searchParams={searchParams} />
      </Suspense>
    </>
  );
}
