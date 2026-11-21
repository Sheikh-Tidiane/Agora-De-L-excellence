import { LetterTile } from "@/components/shared/letter-tile";
import { avatarUrl } from "@/lib/storage-names";
import { cn } from "@/lib/utils";

/**
 * Photo du membre, ou à défaut sa tuile-initiale (l'univers des lettres plutôt qu'une silhouette grise).
 * La photo passe par une adresse réservée aux personnes connectées : jamais publique.
 */
export function MemberAvatar({
  firstName,
  image,
  size = 56,
  className,
}: {
  firstName: string;
  image: string | null;
  size?: number;
  className?: string;
}) {
  if (image) {
    return (
      // Image protégée par la session : l'optimiseur de Next.js la demanderait sans cookie.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl(image)}
        alt=""
        width={size}
        height={size}
        decoding="async"
        className={cn("shrink-0 bg-sable object-cover", className)}
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.14) }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0", className)}
      style={{ fontSize: size }}
    >
      <LetterTile letter={firstName.charAt(0) || "A"} tone="indigo" className="text-[1em]" />
    </span>
  );
}
