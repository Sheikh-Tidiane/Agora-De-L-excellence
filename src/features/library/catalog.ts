/** Livre tel que le site public l'affiche. Types et fonctions pures : testables sans base. */
export type PublicBook = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string;
  clubNote: string | null;
  isClubFavorite: boolean;
  category: { slug: string; name: string };
  authors: { slug: string; name: string; bio: string | null }[];
  /** Auteurs réunis pour l'affichage : « Mariama Bâ ». */
  authorNames: string;
  coverImage: string | null;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  language: string;
  isbn: string | null;
};

export type BookFilter = { q?: string; category?: string; author?: string };

/** Compare sans tenir compte des accents ni de la casse : « bâ » trouve « Bâ » et « ba ». */
export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ").toLowerCase().trim();
}

export function filterBooks(books: PublicBook[], filter: BookFilter): PublicBook[] {
  const words = normalizeSearch(filter.q ?? "")
    .split(/\s+/)
    .filter(Boolean);
  return books.filter((book) => {
    if (filter.category && book.category.slug !== filter.category) return false;
    if (filter.author && !book.authors.some((author) => author.slug === filter.author))
      return false;
    if (words.length === 0) return true;
    const haystack = normalizeSearch(
      [book.title, book.subtitle ?? "", book.authorNames, book.category.name].join(" "),
    );
    return words.every((word) => haystack.includes(word));
  });
}

/** Catégories et auteurs réellement présents au catalogue, avec leur nombre de livres. */
export function catalogFacets(books: PublicBook[]) {
  const categories = new Map<string, { slug: string; name: string; count: number }>();
  const authors = new Map<string, { slug: string; name: string; count: number }>();
  for (const book of books) {
    const category = categories.get(book.category.slug) ?? { ...book.category, count: 0 };
    category.count++;
    categories.set(category.slug, category);
    for (const { slug, name } of book.authors) {
      const author = authors.get(slug) ?? { slug, name, count: 0 };
      author.count++;
      authors.set(slug, author);
    }
  }
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "fr");
  return {
    categories: [...categories.values()].sort(byName),
    authors: [...authors.values()].sort(byName),
  };
}

export function joinAuthors(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "Auteur inconnu";
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}
