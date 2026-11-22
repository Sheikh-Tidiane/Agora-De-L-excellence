import type { Metadata } from "next";
import Link from "next/link";
import { LetterTile } from "@/components/shared/letter-tile";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Page introuvable" };

export default function NotFound() {
  return (
    <main className="page flex flex-1 flex-col justify-center py-16">
      <div className="flex gap-1.5">
        <LetterTile letter="4" value={null} tone="indigo" className="text-[64px]" />
        <LetterTile letter="0" value={null} tone="terracotta" className="text-[64px]" />
        <LetterTile letter="4" value={null} tone="indigo" className="text-[64px]" />
      </div>
      <h1 className="titre-1 mt-8">Ce mot n’est pas au dictionnaire.</h1>
      <p className="chapo mt-4 text-gris">
        La page demandée n’existe pas, ou elle a changé d’adresse.
      </p>
      <div className="mt-8">
        <Link href="/" className={cn(buttonVariants({ variant: "principal" }), "max-sm:w-full")}>
          Revenir à l’accueil
        </Link>
      </div>
    </main>
  );
}
