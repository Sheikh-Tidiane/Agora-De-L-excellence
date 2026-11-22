import type { Metadata } from "next";
import Link from "next/link";
import { LetterTile } from "@/components/shared/letter-tile";
import { buttonVariants } from "@/components/ui/button";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Accès refusé",
  robots: { index: false },
};

export default function AccessDeniedPage() {
  return (
    <div>
      <div className="flex gap-1.5" aria-hidden="true">
        <LetterTile letter="4" value={null} tone="indigo" className="text-[44px]" />
        <LetterTile letter="0" value={null} tone="terracotta" className="text-[44px]" />
        <LetterTile letter="3" value={null} tone="indigo" className="text-[44px]" />
      </div>
      <p className="surtitre mt-8">Accès refusé</p>
      <h1 className="titre-1 mt-3">Cet espace ne vous est pas ouvert.</h1>
      <p className="mt-4 text-[1.0625rem] text-gris">
        Votre compte n’a pas les droits nécessaires pour cette page. Si c’est une erreur, parlez-en
        à un responsable du club.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "principal", size: "lg", largeur: "pleine" }))}
        >
          Revenir à l’accueil
        </Link>
        <SignOutButton variant="contour" size="lg" className="w-full" />
      </div>
    </div>
  );
}
