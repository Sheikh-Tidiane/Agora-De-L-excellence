import Image from "next/image";
import {
  coverFrame,
  GeneratedCover,
  type GeneratedCoverProps,
} from "@/components/shared/generated-cover";
import { uploadUrl } from "@/lib/storage-names";
import { cn } from "@/lib/utils";

type BookCoverProps = GeneratedCoverProps & {
  /** Nom de l'image téléversée par l'admin (`covers/…`). Sans elle : couverture typographique. */
  image?: string | null;
  /** Attribut `sizes` de l'image : largeur réellement affichée. */
  sizes?: string;
  priority?: boolean;
};

/**
 * La couverture d'un livre, partout sur le site (catalogue, fiche, accueil, espace membre,
 * administration). Toujours le même cadre 2:3 : une image téléversée y est recadrée au centre
 * (`object-fit: cover`), quelles que soient ses proportions ; sans image, la couverture
 * typographique générée occupe le même cadre. La largeur se règle par `className`.
 */
export function BookCover({ image, sizes, priority, className, ...cover }: BookCoverProps) {
  if (!image) return <GeneratedCover {...cover} className={className} />;
  return (
    <div className={cn(coverFrame, "bg-sable", className)}>
      <Image
        src={uploadUrl(image)}
        alt={`Couverture de « ${cover.title} », ${cover.author}`}
        fill
        sizes={sizes ?? "(min-width: 1024px) 240px, 46vw"}
        priority={priority}
        className="object-cover object-center"
      />
    </div>
  );
}

/** Taille conseillée d'une image de couverture (ratio 2:3), rappelée à l'envoi dans l'admin. */
export const RECOMMENDED_COVER_SIZE = { width: 600, height: 900 } as const;
