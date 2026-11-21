import Link from "next/link";
import { ByViewer } from "@/components/layout/by-viewer";
import { buttonVariants } from "@/components/ui/button";
import { loginHref, membershipHref } from "@/config/navigation";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { spaceHref, type Viewer } from "@/features/auth/viewer";
import { cn } from "@/lib/utils";

/**
 * Boutons de compte du header : « Se connecter » et « Adhérer » pour un visiteur,
 * « Se déconnecter » et « Mon espace » pour un membre ou un responsable.
 * Lus côté serveur (voir by-viewer.tsx) : jamais d'état faux affiché en attendant.
 */
const principal = cn(buttonVariants({ variant: "principal", size: "sm" }), "min-w-[7.25rem]");
const secondary = cn(buttonVariants({ variant: "discret", size: "sm" }), "hidden lg:inline-flex");

function HeaderButtons({ viewer }: { viewer: Viewer }) {
  if (viewer.kind === "visitor") {
    return (
      <>
        <Link href={loginHref} className={secondary}>
          Se connecter
        </Link>
        <Link href={membershipHref} prefetch={false} className={principal}>
          Adhérer
        </Link>
      </>
    );
  }
  return (
    <>
      <SignOutButton variant="discret" size="sm" className="hidden lg:inline-flex" />
      <Link href={spaceHref(viewer)} className={principal}>
        Mon espace
      </Link>
    </>
  );
}

export function HeaderAccount() {
  return (
    <ByViewer
      reserve={<HeaderButtons viewer={{ kind: "visitor" }} />}
      render={(viewer) => <HeaderButtons viewer={viewer} />}
    />
  );
}

function MenuButtons({ viewer }: { viewer: Viewer }) {
  if (viewer.kind === "visitor") {
    return (
      <>
        <Link
          href={membershipHref}
          className={buttonVariants({ variant: "clair", size: "lg", largeur: "pleine" })}
        >
          Adhérer
        </Link>
        <Link
          href={loginHref}
          className={buttonVariants({ variant: "contour-clair", largeur: "pleine" })}
        >
          Se connecter
        </Link>
      </>
    );
  }
  return (
    <>
      <Link
        href={spaceHref(viewer)}
        className={buttonVariants({ variant: "clair", size: "lg", largeur: "pleine" })}
      >
        Mon espace
      </Link>
      <SignOutButton variant="contour-clair" size="md" className="w-full" formClassName="w-full" />
    </>
  );
}

/** Actions du bas du menu plein écran (mobile). */
export function MenuAccount() {
  return (
    <ByViewer
      reserve={<MenuButtons viewer={{ kind: "visitor" }} />}
      render={(viewer) => <MenuButtons viewer={viewer} />}
    />
  );
}
