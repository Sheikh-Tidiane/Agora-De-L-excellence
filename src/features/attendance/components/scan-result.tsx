"use client";

import { useState } from "react";
import { AlertTriangle, Check, CreditCard } from "lucide-react";
import { StatusPill } from "@/components/admin/page-header";
import type { ScanResponse } from "@/features/attendance/components/scan-api";
import { ScanCardCollect } from "@/features/attendance/components/scan-card-collect";
import { formatTime } from "@/lib/dates";

/** Photo du membre pour le contrôle visuel, ou ses initiales sur une tuile. */
function Portrait({ photoUrl, initials }: { photoUrl: string | null; initials: string }) {
  if (photoUrl) {
    return (
      // Photo privée servie par /api/member/photo : pas d'optimisation d'image publique.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        className="size-28 shrink-0 rounded-feuille bg-sable object-cover md:size-36"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="grid size-28 shrink-0 place-items-center rounded-feuille bg-sable font-serif text-[2.5rem] text-indigo md:size-36"
    >
      {initials}
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-b border-trait py-2">
      <dt className="text-gris">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}

/** Contenu de la feuille de résultat : qui est devant le responsable, et ce qui a été enregistré. */
export function ScanResult({
  result,
  cardFee,
  canCollect,
  onCardPaid,
}: {
  result: ScanResponse;
  /** Montant de la carte, lu dans les réglages (« 1 000 F CFA »). */
  cardFee: string;
  /** Droit d'encaisser (payments.record) : bouton « Encaisser la carte maintenant ». */
  canCollect: boolean;
  onCardPaid: () => void;
}) {
  const [collected, setCollected] = useState<string>();
  if (!result.ok) {
    return (
      <div role="alert" className="flex gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-pastille bg-erreur-fond text-erreur">
          <AlertTriangle aria-hidden="true" className="size-6" />
        </span>
        <div>
          <p className="pt-2.5 text-[1.125rem] leading-snug">{result.message}</p>
        </div>
      </div>
    );
  }
  const { member } = result;
  const time = formatTime(new Date(result.attendedAt));
  const initials = `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase();
  return (
    <div>
      <div className="flex items-center gap-5">
        <Portrait photoUrl={member.photoUrl} initials={initials} />
        <div className="min-w-0">
          <p className="font-serif text-[1.75rem] leading-[1.1] break-words md:text-[2rem]">
            {member.firstName}
            <br />
            {member.lastName}
          </p>
          <p className="mt-2 font-semibold tracking-wide text-gris tabular-nums">
            {member.memberNumber ?? "Sans numéro de membre"}
          </p>
        </div>
      </div>

      <p
        role="status"
        className={
          result.alreadyPresent
            ? "mt-6 flex items-center gap-2 rounded-champ bg-alerte-fond px-4 py-3 font-semibold text-alerte"
            : "mt-6 flex items-center gap-2 rounded-champ bg-succes-fond px-4 py-3 font-semibold text-succes"
        }
      >
        <Check aria-hidden="true" className="size-5 shrink-0" />
        {result.alreadyPresent ? `Déjà pointé à ${time}` : `Présence enregistrée à ${time}`}
      </p>

      {member.cardPaid ? (
        collected ? (
          <p
            role="status"
            className="mt-3 flex items-center gap-2 rounded-champ bg-succes-fond px-4 py-3 font-semibold text-succes"
          >
            <Check aria-hidden="true" className="size-5 shrink-0" />
            Carte réglée : {cardFee} encaissés ({collected}).
          </p>
        ) : null
      ) : (
        <div className="mt-3">
          <p
            role="alert"
            className="flex items-start gap-3 rounded-champ border-l-4 border-alerte bg-alerte-fond px-4 py-3 text-[1.0625rem] leading-snug font-bold text-alerte"
          >
            <CreditCard aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <span>Carte de membre non réglée : {cardFee} à encaisser</span>
          </p>
          {canCollect ? (
            <ScanCardCollect
              userId={member.id}
              cardFee={cardFee}
              onPaid={(label) => {
                setCollected(label);
                onCardPaid();
              }}
            />
          ) : null}
        </div>
      )}

      <dl className="mt-4">
        <Line label="Participation">
          {result.paid ? (
            <StatusPill tone="succes">Réglée</StatusPill>
          ) : (
            <StatusPill tone="neutre">Non réglée</StatusPill>
          )}
        </Line>
        {/* Carte non réglée : le bandeau au-dessus tient lieu d'étiquette. */}
        {member.cardPaid ? (
          <Line label="Carte de membre">
            <StatusPill tone="succes">Réglée</StatusPill>
          </Line>
        ) : null}
        {result.pointsAwarded > 0 ? (
          <Line label="Points">
            <span className="text-terracotta-fonce tabular-nums">+{result.pointsAwarded}</span>
          </Line>
        ) : null}
        <Line label="Pointage">
          {result.method === "QR_SCAN" ? "Carte scannée" : "Saisie manuelle"}
        </Line>
      </dl>
    </div>
  );
}
