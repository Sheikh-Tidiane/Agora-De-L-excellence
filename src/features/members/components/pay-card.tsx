import type { CardDue } from "@/features/members/card-dues";
import type { ClubSettings } from "@/features/settings/schemas";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * « Régler ma carte » : montant, numéros Wave et Orange Money du club, référence à indiquer (le
 * numéro de membre) et date limite du délai de grâce. Pas de paiement en ligne : un responsable
 * enregistre l'encaissement une fois la transaction reçue.
 */
export function PayCardBox({
  due,
  memberNumber,
  settings,
  className,
}: {
  due: CardDue;
  memberNumber: string | null;
  settings: Pick<ClubSettings, "membershipCardFee" | "waveNumber" | "orangeMoneyNumber">;
  className?: string;
}) {
  if (due.paid) return null;
  const numbers = [
    { label: "Wave", value: settings.waveNumber },
    { label: "Orange Money", value: settings.orangeMoneyNumber },
  ].filter((n) => n.value);
  return (
    <section
      aria-labelledby="regler-carte-titre"
      className={cn(
        "rounded-champ border-l-4 bg-blanc px-5 py-4",
        due.overdue ? "border-erreur" : "border-terracotta",
        className,
      )}
    >
      <h2 id="regler-carte-titre" className="font-serif text-[1.375rem] leading-snug">
        Régler ma carte
      </h2>
      <p className="mt-1">
        Carte de membre&nbsp;: <strong>{formatFcfa(settings.membershipCardFee)}</strong>, une seule
        fois.
      </p>
      {due.deadline ? (
        <p className={cn("mt-1 font-semibold", due.overdue ? "text-erreur" : "text-indigo")}>
          {due.overdue
            ? `Le délai pour la régler est passé depuis le ${formatDate(due.deadline)}.`
            : `À régler avant le ${formatDate(due.deadline)}.`}
        </p>
      ) : null}
      <ul className="mt-3 space-y-1.5">
        {numbers.map((n) => (
          <li key={n.label}>
            Par <span className="font-semibold">{n.label}</span> au{" "}
            <span className="font-semibold whitespace-nowrap tabular-nums">{n.value}</span>
          </li>
        ))}
        <li>En espèces, auprès d’un responsable lors d’une rencontre.</li>
      </ul>
      {numbers.length > 0 && memberNumber ? (
        <p className="petit mt-3">
          Pour Wave ou Orange Money, indiquez en motif votre numéro de membre&nbsp;:{" "}
          <span className="font-semibold whitespace-nowrap">{memberNumber}</span>. Un responsable
          enregistre ensuite le paiement ; votre carte passe alors à «&nbsp;réglée&nbsp;».
        </p>
      ) : null}
    </section>
  );
}
