/** « L’Aventure ambiguë » → « l-aventure-ambigue ». */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/**
 * Slug libre à partir d'un texte : `base`, puis `base-2`, `base-3`…
 * `isTaken` interroge la base ; `fallback` sert quand le texte ne contient aucun caractère utilisable.
 */
export async function uniqueSlug(
  text: string,
  isTaken: (slug: string) => Promise<boolean>,
  fallback = "element",
): Promise<string> {
  const base = slugify(text) || fallback;
  if (!(await isTaken(base))) return base;
  for (let i = 2; i < 200; i++) {
    const candidate = `${base}-${i}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${base}-${Date.now()}`;
}
