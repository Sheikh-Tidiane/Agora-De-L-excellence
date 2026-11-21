import { Suspense } from "react";
import type { Metadata } from "next";
import { Tag } from "@/components/shared/event-row";
import { authRoutes } from "@/config/auth";
import { memberCardQr } from "@/features/members/card-service";
import { CardFace } from "@/features/members/components/card-face";
import { KeepCardOffline } from "@/features/members/components/keep-card-offline";
import { RegenerateCard } from "@/features/members/components/regenerate-card";
import { getMembershipCardPayment } from "@/features/members/dashboard-queries";
import { loadClubSettings } from "@/features/settings/club";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Ma carte de membre" };

async function Card() {
  const user = await requirePageAccess("member.access", `${authRoutes.member}/card`);
  const [qr, card, settings] = await Promise.all([
    memberCardQr(user.id, { margin: 2 }),
    getMembershipCardPayment(user.id),
    loadClubSettings(),
  ]);

  return (
    <div className="mt-8 grid gap-10 lg:mt-10 lg:grid-cols-9 lg:items-start lg:gap-x-10">
      {/* Clé = jeton : une carte remplacée remonte le composant, qui range la nouvelle. */}
      <KeepCardOffline key={qr.token} />
      <div className="lg:col-span-5">
        <CardFace
          fullName={user.name}
          memberNumber={user.memberNumber}
          status={
            card ? (
              <Tag tone="succes">Carte réglée</Tag>
            ) : (
              <span className="inline-flex rounded-full bg-terracotta-clair px-2.5 py-1 text-[0.75rem] font-bold text-indigo">
                Carte à régler
              </span>
            )
          }
        />
        <p className="petit mt-4">
          {card ? (
            <>Carte réglée le {formatDate(card.paidAt)}.</>
          ) : (
            <>
              Carte de membre&nbsp;: {formatFcfa(settings.membershipCardFee)}, une fois, en espèces
              auprès d’un responsable lors d’une rencontre.
            </>
          )}
        </p>
      </div>

      <section
        aria-labelledby="qr-titre"
        // Sur téléphone, le code passe en premier : c'est lui qu'on présente à l'entrée.
        className="order-first rounded-[18px] bg-blanc p-6 lg:order-none lg:col-span-4 lg:p-7"
      >
        <h2 id="qr-titre" className="surtitre">
          À présenter à l’entrée
        </h2>
        <div
          role="img"
          aria-label="Code QR de votre carte de membre"
          className="mx-auto mt-5 w-full max-w-[260px] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
          // SVG produit côté serveur par la bibliothèque qrcode à partir du jeton signé.
          dangerouslySetInnerHTML={{ __html: qr.svg }}
        />
        <p className="petit mt-5 text-gris">
          Un responsable le scanne pour pointer votre présence aux rencontres. Il ne contient ni
          votre nom ni votre numéro&nbsp;: seulement une clé signée par le club. Augmentez la
          luminosité de l’écran si la lecture hésite.
        </p>
        <p className="petit mt-3 text-gris">
          Une fois ouverte dans l’application installée ou le navigateur, la carte reste consultable
          sans connexion sur ce téléphone, jusqu’à votre déconnexion.
        </p>
        <div className="mt-6 border-t border-indigo/15 pt-5">
          <p className="petit mb-3 text-gris">
            Téléphone perdu, capture d’écran partagée&nbsp;? Remplacez votre carte&nbsp;: l’ancien
            code cessera d’être accepté.
          </p>
          <RegenerateCard />
        </div>
      </section>
    </div>
  );
}

export default function CardPage() {
  return (
    <>
      <p className="surtitre">Profil</p>
      <h1 className="titre-1 mt-3">Ma carte de membre</h1>
      <Suspense
        fallback={
          <div aria-hidden="true" className="mt-8 grid gap-10 lg:grid-cols-9">
            <div className="skeleton aspect-[1.586] w-full lg:col-span-5" />
            <div className="skeleton h-80 w-full lg:col-span-4" />
          </div>
        }
      >
        <Card />
      </Suspense>
    </>
  );
}
