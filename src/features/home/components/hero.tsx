import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BookCover } from "@/components/shared/book-cover";
import { Hemicycle, type HemicycleRow } from "@/components/shared/hemicycle";
import { LetterTile } from "@/components/shared/letter-tile";
import { buttonVariants } from "@/components/ui/button";
import { membershipHref } from "@/config/navigation";
import { site } from "@/config/site";
import { getCurrentSelection } from "@/features/library/queries";
import { getClubSettings } from "@/features/settings/club";
import { formatDate, formatMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { ByViewer } from "@/components/layout/by-viewer";
import { spaceHref } from "@/features/auth/viewer";

const T = "var(--color-terracotta)";
const C = "var(--color-terracotta-clair)";
const I = "var(--color-indigo)";
const V = "var(--color-trait)";

/**
 * Cinq rangs : les deux premiers sont occupés (terracotta), les suivants attendent
 * leur public (trait), avec quelques places déjà prises.
 */
const rangs: HemicycleRow[] = [
  { radius: 50, fill: C },
  { radius: 65, fill: T },
  { radius: 80, fill: V, accents: { 3: I, 9: T, 14: I } },
  { radius: 95, fill: V, accents: { 6: C, 17: I } },
  { radius: 110, fill: V, accents: { 2: I, 12: C, 21: T } },
];

/** Appel principal d'un visiteur ; un membre voit « Mon espace » à la place. */
function JoinButton() {
  return (
    <Link
      href={membershipHref}
      prefetch={false}
      className={cn(buttonVariants({ variant: "action", size: "lg" }), "max-sm:w-full")}
    >
      Rejoindre le club
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}

export async function Hero() {
  const [selection, club] = await Promise.all([getCurrentSelection(), getClubSettings()]);
  // Le slogan se coupe à la virgule : la seconde moitié porte l'accent.
  const slogan = club.slogan || site.slogan;
  const cut = slogan.indexOf(",");
  const [lead, accent] =
    cut === -1 ? [slogan, ""] : [slogan.slice(0, cut + 1), slogan.slice(cut + 1).trim()];
  const book = selection?.book;

  return (
    <section className="relative overflow-hidden">
      <div className="page relative lg:grid lg:min-h-[calc(100svh-92px)] lg:grid-cols-12 lg:items-center lg:gap-8">
        <div className="relative z-10 pt-9 pb-8 lg:col-span-7 lg:py-24">
          <p className="surtitre">
            <span className="sm:hidden">Lecture · Scrabble · {site.city}</span>
            <span className="max-sm:hidden">
              {site.baseline} · {site.city}
            </span>
          </p>
          <h1 className="titre-affiche mt-4 text-[clamp(2.5rem,1.1rem+5.6vw,5.25rem)]! text-balance lg:mt-6">
            {lead}
            {accent ? <span className="block text-terracotta">{accent}</span> : null}
          </h1>
          <p className="chapo mt-5 text-gris lg:mt-8 lg:max-w-[31rem]">
            {club.shortName} est un lieu de rencontres, d’échanges, de culture, de réflexion et de
            convivialité, autour de la lecture et des jeux de l’esprit. Une rencontre tous les
            quinze jours, à {site.city}.
          </p>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6 lg:mt-10">
            <ByViewer
              reserve={<JoinButton />}
              render={(viewer) =>
                viewer.kind === "visitor" ? (
                  <JoinButton />
                ) : (
                  <Link
                    href={spaceHref(viewer)}
                    className={cn(
                      buttonVariants({ variant: "action", size: "lg" }),
                      "max-sm:w-full",
                    )}
                  >
                    Mon espace
                    <ArrowRight aria-hidden="true" />
                  </Link>
                )
              }
            />
            <Link
              href="/events"
              prefetch={false}
              className="lien inline-flex min-h-11 items-center max-sm:justify-center"
            >
              Voir les prochaines rencontres
            </Link>
          </div>
        </div>

        {/* La scène : l'hémicycle monte du bas de l'écran, le livre du mois au centre. */}
        <div className="relative -mx-5 h-[300px] sm:h-[380px] md:-mx-10 lg:col-span-5 lg:mx-0 lg:h-full lg:min-h-[640px]">
          <div className="absolute top-0 left-1/2 w-[640px] -translate-x-1/2 sm:w-[820px] lg:top-1/2 lg:left-[-70px] lg:w-[740px] lg:translate-x-0 lg:-translate-y-[54%] xl:left-[-40px] xl:w-[820px]">
            <Hemicycle rows={rangs} cascade />
            <div className="absolute top-[35.5%] left-1/2 w-[25%] -translate-x-1/2">
              {book ? (
                <Link
                  href={`/library/${book.slug}`}
                  prefetch={false}
                  className="group block"
                  aria-label={`Livre du mois : ${book.title}, ${book.authorNames}`}
                >
                  <BookCover
                    title={book.title}
                    author={book.authorNames}
                    category={book.category.name}
                    image={book.coverImage}
                    variant="cadre"
                    palette={0}
                    priority
                    sizes="(min-width: 1280px) 205px, (min-width: 640px) 205px, 160px"
                    className="transition-transform duration-200 ease-agora group-hover:-translate-y-1"
                  />
                </Link>
              ) : (
                // Sans livre du mois, la scène reste vide : seule la tuile A1 y est posée.
                <div aria-hidden="true" className="aspect-[2/3]" />
              )}
              <LetterTile
                letter="A"
                tone="blanc"
                className={cn(
                  "absolute text-[clamp(40px,7.2vw,84px)] lg:text-[76px]",
                  book ? "-top-[11%] -left-[31%] -rotate-6" : "top-[18%] left-[22%] -rotate-6",
                )}
              />
            </div>
          </div>
          {/* Cartel du livre du mois : visible dès que la place le permet. */}
          {selection && book ? (
            <div className="absolute bottom-8 left-0 hidden max-w-[20rem] border-l-2 border-indigo pl-4 lg:block xl:bottom-10">
              <p className="surtitre">Livre du mois · {formatMonth(selection.month)}</p>
              <p className="mt-2 font-serif text-xl leading-tight">{book.title}</p>
              <p className="petit mt-1 text-gris">
                {book.authorNames}
                {selection.event ? ` · Rencontre le ${formatDate(selection.event.startsAt)}` : ""}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
