import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authRoutes, safeNextPath } from "@/config/auth";
import { membershipHref } from "@/config/navigation";
import { AuthHeading } from "@/features/auth/components/form-parts";
import { LoginNotice } from "@/features/auth/components/login-notice";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { can, getCurrentUser } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous à votre espace membre.",
  robots: { index: false },
};

/**
 * Déjà connecté (lien « Espace membre », favori, retour arrière) : pas de second formulaire,
 * on va directement dans son espace. Même règle de destination qu'après une connexion.
 */
async function RedirectIfSignedIn({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { next } = await searchParams;
  const requested = safeNextPath(typeof next === "string" ? next : null);
  const home = can(user, "admin.access") ? authRoutes.admin : authRoutes.member;
  redirect(
    requested && (!requested.startsWith(authRoutes.admin) || can(user, "admin.access"))
      ? requested
      : home,
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <Suspense fallback={null}>
        <RedirectIfSignedIn searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <LoginNotice />
      </Suspense>
      <AuthHeading surtitre="Espace membre" title="Bon retour au club." />
      <div className="mt-8">
        <SignInForm />
      </div>
      <p className="mt-8 border-t border-indigo/20 pt-5 text-gris">
        Pas encore membre&nbsp;?{" "}
        <Link href={membershipHref} className="lien inline-block py-2.5">
          Demander mon adhésion
        </Link>
      </p>
    </>
  );
}
