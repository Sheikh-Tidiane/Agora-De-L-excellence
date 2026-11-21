"use client";

import { useState } from "react";
import type { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cancelPaymentAction, recordCardPaymentAction } from "@/features/payments/actions";

/**
 * Formulaires d'encaissement de la carte de membre, ouverts dans la fiche d'un membre.
 * Ils reçoivent l'action du tableau (`run`) : le message de confirmation survit à leur fermeture.
 */
type AdminRun = ReturnType<typeof useAdminAction>["run"];

/** Encaissement de la carte de membre : date (aujourd'hui par défaut) et note facultative. */
export function CardPaymentForm({
  userId,
  amount,
  run,
  pending,
  onDone,
}: {
  userId: string;
  amount: string;
  run: AdminRun;
  pending: boolean;
  onDone: () => void;
}) {
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  return (
    <form
      className="mt-6 flex flex-col gap-4 border-t border-trait pt-5"
      onSubmit={(event) => {
        event.preventDefault();
        void run(() => recordCardPaymentAction({ userId, paidAt, note }), {
          success: `Carte réglée : ${amount} encaissés.`,
          onSuccess: onDone,
        });
      }}
    >
      <p className="surtitre">Carte de membre · {amount}</p>
      <p className="petit text-gris">
        Paiement en espèces, reçu par vous. L’encaissement est consigné dans le journal.
      </p>
      <Field id="carte-date" label="Date d’encaissement">
        <Input
          id="carte-date"
          type="date"
          required
          value={paidAt}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(event) => setPaidAt(event.target.value)}
        />
      </Field>
      <Field id="carte-note" label="Note" optional>
        <Input
          id="carte-note"
          value={note}
          maxLength={200}
          autoComplete="off"
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="action" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer l’encaissement"}
        </Button>
        <Button variant="contour" onClick={onDone}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

/** Annulation d'un encaissement saisi par erreur : le motif est obligatoire. */
export function CancelCardForm({
  paymentId,
  run,
  pending,
  onDone,
}: {
  paymentId: string;
  run: AdminRun;
  pending: boolean;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <form
      className="mt-6 flex flex-col gap-4 rounded-champ border-l-4 border-erreur bg-erreur-fond p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void run(() => cancelPaymentAction({ paymentId, reason }), {
          success: "Encaissement annulé. La carte est de nouveau à régler.",
          onSuccess: onDone,
        });
      }}
    >
      <p className="font-bold text-erreur">Annuler cet encaissement ?</p>
      <Field id="carte-motif" label="Motif">
        <Input
          id="carte-motif"
          required
          minLength={3}
          maxLength={200}
          value={reason}
          autoComplete="off"
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" className="bg-erreur hover:bg-erreur" disabled={pending}>
          {pending ? "Annulation…" : "Annuler l’encaissement"}
        </Button>
        <Button variant="contour" onClick={onDone}>
          Revenir
        </Button>
      </div>
    </form>
  );
}
