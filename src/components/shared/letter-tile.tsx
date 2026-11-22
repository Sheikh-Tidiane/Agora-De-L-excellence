import { cn } from "@/lib/utils";

/** Valeurs des lettres au Scrabble francophone. */
export const LETTER_VALUES: Record<string, number> = {
  A: 1,
  B: 3,
  C: 3,
  D: 2,
  E: 1,
  F: 4,
  G: 2,
  H: 4,
  I: 1,
  J: 8,
  K: 10,
  L: 1,
  M: 2,
  N: 1,
  O: 1,
  P: 3,
  Q: 8,
  R: 1,
  S: 1,
  T: 1,
  U: 1,
  V: 4,
  W: 10,
  X: 10,
  Y: 10,
  Z: 10,
};

const tones = {
  /** Sur fond ivoire ou sable : tuile blanche posée. */
  blanc: "bg-blanc text-indigo shadow-posee",
  /** Sur fond indigo : la tuile A1 du logo. */
  ivoire: "bg-ivoire text-indigo",
  indigo: "bg-indigo text-ivoire",
  terracotta: "bg-terracotta text-blanc",
  clair: "bg-terracotta-clair text-indigo",
  sable: "bg-sable text-indigo",
} as const;

export type LetterTileTone = keyof typeof tones;

type LetterTileProps = {
  /** Une lettre, ou un nombre court (rang, numéro). */
  letter: string;
  /** Valeur en indice. Par défaut : la valeur Scrabble de la lettre. `null` pour la masquer. */
  value?: number | string | null;
  tone?: LetterTileTone;
  /** Texte lu par les lecteurs d'écran. Sans lui, la tuile est décorative. */
  label?: string;
  /** La taille se règle par la taille de police : `text-[56px]` donne une tuile de 56 px. */
  className?: string;
};

export function LetterTile({ letter, value, tone = "blanc", label, className }: LetterTileProps) {
  const glyph = letter.toUpperCase();
  const shown = value === undefined ? LETTER_VALUES[glyph] : value;

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "relative inline-grid size-[1em] shrink-0 place-items-center rounded-[0.14em] text-[48px] leading-none select-none",
        tones[tone],
        className,
      )}
    >
      <span className={cn("font-serif", glyph.length > 1 ? "text-[0.46em]" : "text-[0.62em]")}>
        {glyph}
      </span>
      {shown !== null && shown !== undefined ? (
        <span className="absolute right-[0.11em] bottom-[0.09em] font-sans text-[max(0.22em,9px)] font-bold">
          {shown}
        </span>
      ) : null}
    </span>
  );
}

/** Un mot posé en tuiles, lu comme un seul mot par les lecteurs d'écran. */
export function TileWord({
  word,
  tone = "blanc",
  className,
  tileClassName,
}: {
  word: string;
  tone?: LetterTileTone;
  className?: string;
  tileClassName?: string;
}) {
  return (
    <span role="img" aria-label={word} className={cn("inline-flex gap-[3px]", className)}>
      {Array.from(word).map((char, i) => (
        <LetterTile key={`${char}-${i}`} letter={char} tone={tone} className={tileClassName} />
      ))}
    </span>
  );
}
