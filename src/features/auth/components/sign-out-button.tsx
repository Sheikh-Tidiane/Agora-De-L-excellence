"use client";

import { LogOut } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { CARD_CACHE } from "@/features/members/offline-card";

/**
 * Déconnexion : un vrai formulaire, qui fonctionne même sans JavaScript.
 * Avec JavaScript, il efface d'abord la carte gardée pour le hors-ligne : sur un téléphone
 * partagé, la personne suivante ne la retrouve pas.
 */
export function SignOutButton({
  variant = "contour",
  size = "sm",
  className,
  formClassName,
}: Pick<ButtonProps, "variant" | "size" | "className"> & { formClassName?: string }) {
  return (
    <form
      action={signOutAction}
      className={formClassName}
      onSubmit={() => {
        if ("caches" in window) void caches.delete(CARD_CACHE).catch(() => undefined);
      }}
    >
      <Button type="submit" variant={variant} size={size} className={className}>
        <LogOut aria-hidden="true" />
        Se déconnecter
      </Button>
    </form>
  );
}
