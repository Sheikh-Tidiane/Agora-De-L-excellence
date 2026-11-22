import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { authConfig, authRoutes } from "@/config/auth";
import { AuthHeading } from "@/features/auth/components/form-parts";
import { InvalidLink, PasswordFormSkeleton } from "@/features/auth/components/link-states";
import { SetPasswordForm } from "@/features/auth/components/set-password-form";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  robots: { index: false },
  referrer: "no-referrer",
};

async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (typeof token !== "string" || token.length < 16) {
    return (
      <InvalidLink
        title="Ce lien est incomplet."
        action={
          <Link
            href={authRoutes.forgotPassword}
            className={cn(buttonVariants({ variant: "principal", size: "lg", largeur: "pleine" }))}
          >
            Demander un nouveau lien
          </Link>
        }
      >
        Ouvrez le lien reçu par e-mail en entier, ou demandez-en un nouveau&nbsp;: il reste valable{" "}
        {authConfig.resetLinkMinutes}&nbsp;minutes.
      </InvalidLink>
    );
  }

  // La validité du jeton est vérifiée à l'envoi : l'afficher ici ne révèle rien et ne le consomme pas.
  return (
    <>
      <AuthHeading surtitre="Mot de passe oublié" title="Un nouveau mot de passe.">
        Choisissez-le bien&nbsp;: il remplace l’ancien, et vos autres sessions seront fermées.
      </AuthHeading>
      <div className="mt-8">
        <SetPasswordForm mode="reset" token={token} />
      </div>
      <p className="mt-6">
        <Link href={authRoutes.forgotPassword} className="lien inline-flex min-h-11 items-center">
          Le lien ne fonctionne plus&nbsp;? En demander un autre
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <Suspense fallback={<PasswordFormSkeleton />}>
      <Reset searchParams={searchParams} />
    </Suspense>
  );
}
