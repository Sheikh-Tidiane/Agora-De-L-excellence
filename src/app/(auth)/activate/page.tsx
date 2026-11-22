import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { authConfig } from "@/config/auth";
import { AuthHeading } from "@/features/auth/components/form-parts";
import { InvalidLink, PasswordFormSkeleton } from "@/features/auth/components/link-states";
import { SetPasswordForm } from "@/features/auth/components/set-password-form";
import { getActivationInvite } from "@/features/auth/service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Activer mon compte",
  robots: { index: false },
  // Le jeton est dans l'adresse : elle ne doit pas fuiter vers un autre site.
  referrer: "no-referrer",
};

async function Activation({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const invite = typeof token === "string" ? await getActivationInvite(token) : null;

  if (!invite || typeof token !== "string") {
    return (
      <InvalidLink
        action={
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "principal", size: "lg", largeur: "pleine" }))}
          >
            Revenir à l’accueil
          </Link>
        }
      >
        Un lien d’activation reste valable {authConfig.activationLinkDays}&nbsp;jours et ne sert
        qu’une fois. Si votre compte n’est pas encore activé, écrivez au club&nbsp;: un responsable
        vous en renverra un.
      </InvalidLink>
    );
  }

  return (
    <>
      <AuthHeading surtitre="Activation du compte" title={`Bienvenue, ${invite.firstName}.`}>
        Dernière étape&nbsp;: choisissez le mot de passe de votre espace membre.
      </AuthHeading>
      <div className="mt-8">
        <SetPasswordForm mode="activation" token={token} />
      </div>
    </>
  );
}

export default function ActivatePage({ searchParams }: PageProps<"/activate">) {
  return (
    <Suspense fallback={<PasswordFormSkeleton />}>
      <Activation searchParams={searchParams} />
    </Suspense>
  );
}
