import { Fragment, type ReactNode } from "react";

/**
 * Rendu Markdown minimal des articles, sans dépendance : titres (##, ###), paragraphes,
 * listes, citations, gras, italique et liens. Tout passe par des éléments React :
 * aucun HTML saisi n'est interprété.
 */
export type MarkdownBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const chunks = source.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  for (const raw of chunks) {
    const chunk = raw.trim();
    if (!chunk) continue;
    const lines = chunk.split("\n").map((line) => line.trim());
    const heading = /^(#{1,3})\s+(.+)$/.exec(lines[0]!);
    if (heading && lines.length === 1) {
      // Le titre de l'article est le seul h1 de la page : « # » devient un intertitre.
      blocks.push({ type: "heading", level: heading[1]!.length >= 3 ? 3 : 2, text: heading[2]! });
    } else if (lines.every((line) => /^[-*]\s+/.test(line))) {
      blocks.push({
        type: "list",
        ordered: false,
        items: lines.map((line) => line.replace(/^[-*]\s+/, "")),
      });
    } else if (lines.every((line) => /^\d+[.)]\s+/.test(line))) {
      blocks.push({
        type: "list",
        ordered: true,
        items: lines.map((line) => line.replace(/^\d+[.)]\s+/, "")),
      });
    } else if (lines.every((line) => line.startsWith(">"))) {
      blocks.push({ type: "quote", text: lines.map((l) => l.replace(/^>\s?/, "")).join(" ") });
    } else {
      blocks.push({ type: "paragraph", text: lines.join(" ") });
    }
  }
  return blocks;
}

/** N'autorise que les liens http(s), mailto et les chemins internes. */
export function safeHref(href: string): string | null {
  const value = href.trim();
  if (/^(https?:\/\/|mailto:)/i.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return null;
}

const inlinePattern = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;

export function renderInline(text: string): ReactNode[] {
  return text.split(inlinePattern).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = safeHref(link[2]!);
      if (!href) return <Fragment key={i}>{link[1]}</Fragment>;
      const external = !href.startsWith("/");
      return (
        <a
          key={i}
          href={href}
          className="lien"
          {...(external ? { rel: "noopener noreferrer" } : {})}
        >
          {link[1]}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Corps d'article : colonne de lecture, lettrine sur le premier paragraphe. */
export function Markdown({ source, lettrine = false }: { source: string; lettrine?: boolean }) {
  const blocks = parseMarkdown(source);
  const firstParagraph = blocks.findIndex((block) => block.type === "paragraph");
  return (
    <div className="prose-agora">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return block.level === 2 ? (
              <h2 key={i}>{renderInline(block.text)}</h2>
            ) : (
              <h3 key={i}>{renderInline(block.text)}</h3>
            );
          case "quote":
            return <blockquote key={i}>{renderInline(block.text)}</blockquote>;
          case "list": {
            const items = block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>);
            return block.ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>;
          }
          default:
            return (
              <p key={i} className={lettrine && i === firstParagraph ? "lettrine" : undefined}>
                {renderInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}

/** Temps de lecture estimé (200 mots par minute), au moins une minute. */
export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
