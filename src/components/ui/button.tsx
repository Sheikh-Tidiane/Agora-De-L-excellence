import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Bouton du club. Base shadcn/ui réhabillée : rayon 10 px, hauteur tactile ≥ 44 px,
 * enfoncement à la pression, aucune ombre.
 * `buttonVariants` s'applique aussi à un lien : <Link className={buttonVariants()} />.
 */
export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-champ font-sans font-semibold whitespace-nowrap",
    "transition-[background-color,color,border-color,transform] duration-200 ease-agora",
    "active:translate-y-px active:scale-[0.985] active:duration-100",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:size-[1.1em] [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /** Action principale de la page : une seule par écran. */
        action: "bg-terracotta-fonce text-blanc hover:bg-indigo",
        principal: "bg-indigo text-ivoire hover:bg-indigo-profond",
        contour: "border border-indigo/25 text-indigo hover:border-indigo hover:bg-indigo/5",
        /** Sur fond indigo. */
        clair: "bg-ivoire text-indigo hover:bg-blanc",
        "contour-clair":
          "border border-ivoire/30 text-ivoire hover:border-ivoire hover:bg-ivoire/10",
        discret: "text-indigo hover:bg-indigo/5",
      },
      size: {
        md: "h-12 px-5 text-base",
        sm: "h-11 px-4 text-[0.9375rem]",
        lg: "h-14 px-7 text-[1.0625rem]",
        icone: "size-11",
      },
      largeur: {
        auto: "",
        pleine: "w-full",
      },
    },
    defaultVariants: { variant: "principal", size: "md", largeur: "auto" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  largeur,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, largeur }), className)}
      {...props}
    />
  );
}
