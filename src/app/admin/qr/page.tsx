import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import QRCode from "qrcode";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { membershipHref } from "@/config/navigation";
import { PrintButton } from "@/features/memberships/components/print-button";
import { loadClubSettings } from "@/features/settings/club";
import { env } from "@/lib/env";
import { formatFcfa } from "@/lib/money";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "QR d’adhésion" };

const steps = [
  "Ouvrez l’appareil photo de votre téléphone.",
  "Visez le code : le formulaire d’adhésion s’ouvre.",
  "Deux minutes, sans créer de compte. La réponse arrive par e-mail.",
];

async function Poster() {
  await requirePageAccess("memberships.review", "/admin/qr");
  const club = await loadClubSettings();
  // Le code mène droit au formulaire : les montants s'affichent juste au-dessus.
  const target = `${env.APP_URL}${membershipHref}#demande`;
  const svg = await QRCode.toString(target, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: "#1F2A55", light: "#FFFFFF" },
  });
  const local = /localhost|127\.0\.0\.1/.test(env.APP_URL);

  return (
    <>
      <AdminPageHeader title="QR d’adhésion" actions={<PrintButton />}>
        Une affiche à imprimer pour le lancement et les rencontres : les participants ouvrent le
        formulaire d’adhésion depuis leur téléphone.
      </AdminPageHeader>

      {local ? (
        <p className="mb-6 max-w-[46rem] rounded-champ border-l-4 border-alerte bg-alerte-fond px-4 py-3 text-[0.9375rem]">
          <span className="font-bold text-alerte">Adresse locale.</span> Ce code mène à{" "}
          <span className="font-semibold break-all">{target}</span>, qui ne s’ouvre que sur cet
          ordinateur. Imprimez l’affiche depuis le site en ligne (variable <code>APP_URL</code>).
        </p>
      ) : (
        <p className="mb-6 text-gris">
          Le code mène à <span className="font-semibold break-all text-indigo">{target}</span>
        </p>
      )}

      {/* L'affiche : seule partie de la page qui s'imprime (format A4, portrait). */}
      <div className="affiche mx-auto flex aspect-[210/297] w-full max-w-[640px] flex-col items-center bg-blanc px-[8%] py-[7%] text-center text-indigo">
        <Image
          src="/logos/logo-vertical.svg"
          alt={club.name}
          width={200}
          height={200}
          unoptimized
          className="h-auto w-[30%]"
        />
        <p className="mt-[5%] font-serif text-[clamp(1.5rem,5.2cqw,2.75rem)] leading-[1.05]">
          Rejoignez le club
          <span className="block text-terracotta">depuis votre téléphone.</span>
        </p>
        <div
          aria-label={`QR code vers ${target}`}
          role="img"
          className="mt-[6%] w-[52%] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <ol className="mt-[6%] w-full max-w-[26rem] text-left text-[0.9375rem]">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3 border-t border-indigo/25 py-2">
              <span className="font-serif text-lg leading-6 text-terracotta">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-auto pt-[4%] text-[0.875rem] font-semibold">
          Carte de membre {formatFcfa(club.membershipCardFee)} · Participation{" "}
          {formatFcfa(club.sessionFee)} par séance
        </p>
        <p className="mt-1 text-[0.8125rem] break-all text-gris">
          {target.replace(/^https?:\/\//, "").replace(/#.*$/, "")}
        </p>
      </div>
    </>
  );
}

export default function QrPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Poster />
    </Suspense>
  );
}
