import Link from "next/link";
import { BookCover } from "@/components/shared/book-cover";
import { cn } from "@/lib/utils";

type BookCardProps = {
  href: string;
  title: string;
  author: string;
  category: string;
  /** Le mot du club, affiché sous le titre. */
  note?: string | null;
  /** Image téléversée par l'admin ; sinon couverture générée. */
  image?: string | null;
  sizes?: string;
  className?: string;
};

/** Un livre sur l'étagère : la couverture d'abord, le texte en légende. Pas de boîte. */
export function BookCard({
  href,
  title,
  author,
  category,
  note,
  image,
  sizes,
  className,
}: BookCardProps) {
  return (
    <article className={cn("group relative", className)}>
      <BookCover
        title={title}
        author={author}
        category={category}
        image={image}
        sizes={sizes}
        className="transition-transform duration-200 ease-agora group-hover:-translate-y-1 group-active:translate-y-0"
      />
      <p className="surtitre mt-4 text-[0.6875rem]!">{category}</p>
      <h3 className="mt-1.5 font-serif text-lg leading-snug">
        <Link href={href} className="after:absolute after:inset-0">
          {title}
        </Link>
      </h3>
      <p className="petit text-gris">{author}</p>
      {note ? <p className="petit mt-2">{note}</p> : null}
    </article>
  );
}
