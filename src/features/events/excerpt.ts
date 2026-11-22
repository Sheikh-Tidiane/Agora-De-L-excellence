/** Premières phrases d'un compte rendu, sans la syntaxe Markdown. */
export function excerpt(markdown: string, max = 220): string {
  const text = markdown
    .replace(/^#{1,3}\s+.*$/gm, "")
    .replace(/^[-*>]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40))}…`;
}
