import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import type { BookFilter } from "@/features/library/catalog";

type Facet = { slug: string; name: string; count: number };

/**
 * Recherche et filtres du catalogue. Un vrai formulaire GET : il fonctionne sans JavaScript,
 * et l'adresse obtenue se partage.
 */
export function CatalogFilters({
  filter,
  categories,
  authors,
}: {
  filter: BookFilter;
  categories: Facet[];
  authors: Facet[];
}) {
  const active = Boolean(filter.q || filter.category || filter.author);
  return (
    <Form
      action="/library"
      role="search"
      aria-label="Rechercher dans le catalogue"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end"
    >
      <div className="sm:col-span-2 lg:col-span-1">
        <label htmlFor="q" className="mb-1.5 block text-[0.9375rem] font-semibold">
          Titre ou auteur
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-gris"
          />
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={filter.q ?? ""}
            placeholder="Mariama Bâ, L’Aventure…"
            enterKeyHint="search"
            autoComplete="off"
            className="pl-11"
          />
        </div>
      </div>
      <div>
        <label htmlFor="category" className="mb-1.5 block text-[0.9375rem] font-semibold">
          Catégorie
        </label>
        <Select id="category" name="category" defaultValue={filter.category ?? ""}>
          <option value="">Toutes</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name} ({category.count})
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="author" className="mb-1.5 block text-[0.9375rem] font-semibold">
          Auteur
        </label>
        <Select id="author" name="author" defaultValue={filter.author ?? ""}>
          <option value="">Tous</option>
          {authors.map((author) => (
            <option key={author.slug} value={author.slug}>
              {author.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center gap-4 sm:col-span-2 lg:col-span-1">
        <Button type="submit" className="max-sm:flex-1">
          Chercher
        </Button>
        {active ? (
          <Link href="/library" className="lien inline-flex min-h-11 items-center">
            Tout afficher
          </Link>
        ) : null}
      </div>
    </Form>
  );
}
