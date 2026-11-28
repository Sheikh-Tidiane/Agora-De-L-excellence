"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { recordCardPaymentAction } from "@/features/payments/actions";
import {
  missingReference,
  needsReference,
  paymentMethodCodes,
  paymentMethodLabels,
  type PaymentMethodCode,
} from "@/features/payments/methods";

/**
 * Encaissement de la carte de membre depuis l'écran du scan, pour le responsable qui a le droit
 * des paiements : même action et même service que la fiche membre (contrôle de la référence,
 * doublons refusés, entrée « payment.recorded » au journal). La présence est déjà enregistrée.
 */
export function ScanCardCollect({
  userId,
  cardFee,
  onPaid,
}: {
  userId: string;
  cardFee: string;
  onPaid: (label: string) => void;
}) {
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethodCode>("CASH");
  const [reference, setReference] = useState("");
  const [referenceError, setReferenceError] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button
        variant="action"
        size="lg"
        largeur="pleine"
        className="mt-3"
        onClick={() => setOpen(true)}
      >
        Encaisser la carte maintenant
      </Button>
    );
  }

  return (
    <form
      noValidate
      aria-label="Encaisser la carte de membre"
      className="mt-3 flex flex-col gap-4 rounded-champ border border-trait bg-blanc p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const missing = missingReference(method, reference);
        setReferenceError(missing);
        setError(undefined);
        if (missing) return;
        startTransition(async () => {
          const result = await recordCardPaymentAction({
            userId,
            method,
            reference,
            paidAt: new Date().toISOString().slice(0, 10),
            note: "Encaissée au scan",
          });
          if (result.ok) onPaid(paymentMethodLabels[method]);
          else if (result.fieldErrors?.reference) setReferenceError(result.fieldErrors.reference);
          else setError(result.message);
        });
      }}
    >
      <p className="surtitre">Carte de membre · {cardFee}</p>
      <Field id={`${ids}-moyen`} label="Moyen de paiement">
        <Select
          id={`${ids}-moyen`}
          value={method}
          onChange={(event) => {
            setMethod(event.target.value as PaymentMethodCode);
            setReferenceError(undefined);
          }}
        >
          {paymentMethodCodes.map((code) => (
            <option key={code} value={code}>
              {paymentMethodLabels[code]}
            </option>
          ))}
        </Select>
      </Field>
      {needsReference(method) ? (
        <Field
          id={`${ids}-reference`}
          label="Référence de la transaction"
          error={referenceError}
          hint="Le numéro de transaction affiché sur le reçu du membre."
        >
          <Input
            id={`${ids}-reference`}
            value={reference}
            maxLength={60}
            autoComplete="off"
            aria-invalid={referenceError ? true : undefined}
            onChange={(event) => setReference(event.target.value)}
          />
        </Field>
      ) : null}
      {error ? (
        <p role="alert" className="petit font-semibold text-erreur">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" variant="action" size="lg" disabled={pending}>
          {pending ? "Enregistrement…" : `Encaisser ${cardFee}`}
        </Button>
        <Button variant="contour" size="lg" onClick={() => setOpen(false)} disabled={pending}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
