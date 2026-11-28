"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/page-header";
import { PanelRow, SidePanel } from "@/components/admin/side-panel";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { TextField } from "@/components/shared/form-fields";
import { EmptyState } from "@/components/shared/states";
import { useActionForm } from "@/components/shared/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/features/auth/components/form-parts";
import {
  archiveMemberAction,
  reactivateMemberAction,
  renewMembershipAction,
  resendActivationAction,
  suspendMemberAction,
  updateMemberAction,
} from "@/features/members/actions";
import { memberUpdateSchema } from "@/features/members/schemas";
import { CancelCardForm, CardPaymentForm } from "@/features/payments/components/card-payment-forms";
import { formatFcfa } from "@/lib/money";
import { formatDate, formatShortDate } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";

export type MemberRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  memberNumber: string | null;
  /** État lisible, calculé côté serveur : compte + adhésion. */
  state: "active" | "pending" | "expired" | "suspended" | "none";
  joinedAt: Date;
  endsAt: Date | null;
  /** Encaissement actif de la carte de membre ; `null` : carte non réglée. */
  card: {
    paymentId: string;
    amount: number;
    paidAt: Date;
    /** « Wave · T_123 », « Espèces ». */
    method: string;
    receivedBy: string | null;
  } | null;
  periods: number;
  registrations: number;
  isSelf: boolean;
  /** Acceptation de l'adhésion (début de la première adhésion) ; `null` : aucune adhésion. */
  acceptedAt: Date | null;
  /** Jours écoulés depuis l'acceptation. */
  daysSinceAcceptance: number | null;
  /** Carte non réglée et délai de grâce passé. */
  cardOverdue: boolean;
  /** Accord pour publier photos, vidéos, témoignage ; `null` : pas d'accord. */
  mediaConsentAt: Date | null;
};

const cardLabel = (row: MemberRow) =>
  row.card ? "Réglée" : row.cardOverdue ? "Non réglée, délai passé" : "Non réglée";

const stateLabels = {
  active: "À jour",
  pending: "À activer",
  expired: "Adhésion expirée",
  suspended: "Suspendu",
  none: "Sans adhésion",
} as const;
const stateTones = {
  active: "succes",
  pending: "alerte",
  expired: "alerte",
  suspended: "erreur",
  none: "neutre",
} as const;

const State = ({ state }: { state: MemberRow["state"] }) => (
  <StatusPill tone={stateTones[state]}>{stateLabels[state]}</StatusPill>
);

const columns: Column<MemberRow>[] = [
  {
    key: "name",
    header: "Membre",
    cell: (row) => `${row.firstName} ${row.lastName}`,
    sort: (row) => `${row.lastName} ${row.firstName}`,
  },
  {
    key: "number",
    header: "N° de membre",
    cell: (row) => <span className="tabular-nums">{row.memberNumber ?? "—"}</span>,
    sort: (row) => row.memberNumber,
  },
  {
    key: "email",
    header: "E-mail",
    cell: (row) => row.email,
    sort: (row) => row.email,
    className: "max-xl:hidden text-gris",
  },
  {
    key: "state",
    header: "État",
    cell: (row) => <State state={row.state} />,
    sort: (row) => row.state,
  },
  {
    key: "endsAt",
    header: "Échéance",
    cell: (row) => (
      <span className="tabular-nums">{row.endsAt ? formatShortDate(row.endsAt) : "—"}</span>
    ),
    sort: (row) => row.endsAt?.getTime() ?? null,
  },
  {
    key: "fee",
    header: "Carte",
    cell: (row) => (
      <span className={row.cardOverdue ? "font-semibold text-erreur" : undefined}>
        {cardLabel(row)}
      </span>
    ),
    sort: (row) => (row.card ? 2 : row.cardOverdue ? 0 : 1),
    className: "max-lg:hidden",
  },
  {
    key: "accepted",
    header: "Adhésion",
    // Date d'acceptation et, tant que la carte n'est pas réglée, les jours écoulés depuis.
    cell: (row) =>
      row.acceptedAt ? (
        <span className="tabular-nums">
          {formatShortDate(row.acceptedAt)}
          {!row.card && row.daysSinceAcceptance !== null ? (
            <span className="petit block text-gris">
              il y a {row.daysSinceAcceptance} jour{row.daysSinceAcceptance > 1 ? "s" : ""}
            </span>
          ) : null}
        </span>
      ) : (
        "—"
      ),
    sort: (row) => row.daysSinceAcceptance,
    className: "max-lg:hidden",
  },
];

function EditForm({ member, onDone }: { member: MemberRow; onDone: () => void }) {
  const { run, toast } = useAdminAction();
  const { form, pending, formError, submit } = useActionForm({
    schema: memberUpdateSchema,
    defaultValues: {
      userId: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone ? formatPhone(member.phone) : "",
    },
    // L'action passe par `run` pour rafraîchir la liste et annoncer le résultat.
    action: async (values) => {
      const result = await updateMemberAction(values);
      if (result.ok)
        await run(async () => result, { success: "Fiche enregistrée.", onSuccess: onDone });
      return result;
    },
  });
  return (
    <form
      onSubmit={submit}
      noValidate
      className="mt-6 flex flex-col gap-4 border-t border-trait pt-5"
    >
      <p className="surtitre">Modifier la fiche</p>
      <FormError message={formError} />
      <TextField form={form} name="firstName" idPrefix="membre" label="Prénom" autoComplete="off" />
      <TextField form={form} name="lastName" idPrefix="membre" label="Nom" autoComplete="off" />
      <TextField
        form={form}
        name="phone"
        idPrefix="membre"
        label="Téléphone"
        optional
        type="tel"
        inputMode="tel"
        autoComplete="off"
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button variant="contour" onClick={onDone}>
          Annuler
        </Button>
      </div>
      {toast}
    </form>
  );
}

/** Membres : liste triable et filtrable ; fiche, statut, renouvellement et archivage dans un panneau. */
export function MembersTable({
  rows,
  canManage,
  canRecordPayment,
  cardFee,
  initialOpenId,
}: {
  rows: MemberRow[];
  canManage: boolean;
  canRecordPayment: boolean;
  /** Montant de la carte en vigueur (réglage du club). */
  cardFee: number;
  initialOpenId?: string;
}) {
  const { run, pending, toast } = useAdminAction();
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [mode, setMode] = useState<"view" | "edit" | "archive" | "card" | "cancelCard">("view");
  const open = rows.find((row) => row.id === openId) ?? null;
  const close = () => {
    setOpenId(null);
    setMode("view");
  };

  return (
    <>
      <DataTable
        label="Membres"
        rows={rows}
        columns={columns}
        getId={(row) => row.id}
        searchText={(row) =>
          `${row.firstName} ${row.lastName} ${row.email} ${row.memberNumber ?? ""}`
        }
        searchPlaceholder="Nom, e-mail ou numéro…"
        filters={[
          {
            key: "state",
            label: "État",
            get: (row) => row.state,
            options: Object.entries(stateLabels).map(([value, label]) => ({ value, label })),
          },
          {
            key: "fee",
            label: "Carte",
            // « Non réglée » comprend les cartes en retard ; « délai passé » ne montre qu'elles.
            get: (row) => (row.card ? "paid" : row.cardOverdue ? ["unpaid", "overdue"] : "unpaid"),
            options: [
              { value: "paid", label: "Réglée" },
              { value: "unpaid", label: "Non réglée" },
              { value: "overdue", label: "Non réglée, délai passé" },
            ],
          },
        ]}
        defaultSort={{ key: "name", direction: "asc" }}
        onOpen={(row) => setOpenId(row.id)}
        card={(row) => (
          <>
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold">
                {row.firstName} {row.lastName}
              </span>
              <State state={row.state} />
            </span>
            <span className="petit mt-1 block text-gris tabular-nums">
              {row.memberNumber ?? "Sans numéro"}
              {row.endsAt ? ` · jusqu’au ${formatShortDate(row.endsAt)}` : ""}
            </span>
          </>
        )}
        empty={
          <EmptyState title="Aucun membre ici">
            Les membres apparaissent dès qu’une demande d’adhésion est validée.
          </EmptyState>
        }
      />

      <SidePanel
        open={open !== null}
        onClose={close}
        surtitre={open?.memberNumber ?? "Membre"}
        title={open ? `${open.firstName} ${open.lastName}` : ""}
      >
        {open ? (
          <>
            <div className="mb-4">
              <State state={open.state} />
            </div>
            <dl className="border-t border-trait">
              <PanelRow label="E-mail">
                <a href={`mailto:${open.email}`} className="lien break-all">
                  {open.email}
                </a>
              </PanelRow>
              <PanelRow label="Téléphone">
                {open.phone ? (
                  <a href={`tel:${open.phone}`} className="lien">
                    {formatPhone(open.phone)}
                  </a>
                ) : null}
              </PanelRow>
              <PanelRow label="Compte créé le">{formatDate(open.joinedAt)}</PanelRow>
              <PanelRow label="Adhésion jusqu’au">
                {open.endsAt ? formatDate(open.endsAt) : null}
              </PanelRow>
              <PanelRow label="Périodes">{open.periods > 0 ? String(open.periods) : null}</PanelRow>
              <PanelRow label="Carte de membre">
                {open.card
                  ? `Réglée le ${formatDate(open.card.paidAt)} · ${formatFcfa(open.card.amount)} · ${open.card.method}${
                      open.card.receivedBy ? ` · reçu par ${open.card.receivedBy}` : ""
                    }`
                  : "Non réglée"}
              </PanelRow>
              <PanelRow label="Photos et témoignage">
                {open.mediaConsentAt
                  ? `Accord donné le ${formatDate(open.mediaConsentAt)}`
                  : "Pas d’accord : ne pas publier d’image où il est reconnaissable"}
              </PanelRow>
              <PanelRow label="Inscriptions">
                {open.registrations > 0 ? `${open.registrations} rencontre(s)` : "Aucune"}
              </PanelRow>
            </dl>

            {canRecordPayment && mode === "view" && open.memberNumber ? (
              <div className="mt-6">
                {open.card ? (
                  <Button variant="discret" onClick={() => setMode("cancelCard")}>
                    Annuler l’encaissement de la carte…
                  </Button>
                ) : (
                  <Button variant="action" largeur="pleine" onClick={() => setMode("card")}>
                    Encaisser la carte · {formatFcfa(cardFee)}
                  </Button>
                )}
              </div>
            ) : null}
            {canRecordPayment && mode === "card" ? (
              <CardPaymentForm
                key={open.id}
                userId={open.id}
                amount={formatFcfa(cardFee)}
                run={run}
                pending={pending}
                onDone={() => setMode("view")}
              />
            ) : null}
            {canRecordPayment && mode === "cancelCard" && open.card ? (
              <CancelCardForm
                paymentId={open.card.paymentId}
                run={run}
                pending={pending}
                onDone={() => setMode("view")}
              />
            ) : null}

            {canManage && mode === "view" ? (
              <div className="mt-3 flex flex-col gap-2">
                {open.state === "pending" ? (
                  <Button
                    variant="principal"
                    disabled={pending}
                    onClick={() =>
                      void run(() => resendActivationAction({ userId: open.id }), {
                        success: "Un nouveau lien d’activation est parti par e-mail.",
                      })
                    }
                  >
                    Renvoyer le lien d’activation
                  </Button>
                ) : null}
                {open.state !== "suspended" && open.state !== "none" ? (
                  <Button
                    variant={open.state === "expired" ? "action" : "contour"}
                    disabled={pending}
                    onClick={() =>
                      void run(() => renewMembershipAction({ userId: open.id }), {
                        success: (data) =>
                          `Adhésion renouvelée jusqu’au ${formatDate(data.endsAt)}.`,
                      })
                    }
                  >
                    Renouveler l’adhésion
                  </Button>
                ) : null}
                <Button variant="contour" onClick={() => setMode("edit")}>
                  Modifier la fiche
                </Button>
                {open.isSelf ? null : open.state === "suspended" ? (
                  <Button
                    variant="contour"
                    disabled={pending}
                    onClick={() =>
                      void run(() => reactivateMemberAction({ userId: open.id }), {
                        success: "Compte réactivé.",
                      })
                    }
                  >
                    Réactiver le compte
                  </Button>
                ) : open.state !== "pending" ? (
                  <Button
                    variant="contour"
                    disabled={pending}
                    onClick={() =>
                      void run(() => suspendMemberAction({ userId: open.id, reason: "" }), {
                        success: "Compte suspendu : ses sessions sont fermées.",
                      })
                    }
                  >
                    Suspendre le compte
                  </Button>
                ) : null}
                {open.isSelf ? null : (
                  <Button
                    variant="discret"
                    className="text-erreur hover:bg-erreur-fond"
                    onClick={() => setMode("archive")}
                  >
                    Archiver ce membre…
                  </Button>
                )}
              </div>
            ) : null}

            {canManage && mode === "edit" ? (
              <EditForm key={open.id} member={open} onDone={() => setMode("view")} />
            ) : null}

            {canManage && mode === "archive" ? (
              <div className="mt-6 rounded-champ border-l-4 border-erreur bg-erreur-fond p-4">
                <p className="font-bold text-erreur">Archiver {open.firstName} ?</p>
                <p className="mt-1 text-[0.9375rem]">
                  Son nom, son e-mail et son téléphone seront effacés, et il ne pourra plus se
                  connecter. Son historique reste, sans son identité. Cette action est définitive.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="principal"
                    className="bg-erreur hover:bg-erreur"
                    disabled={pending}
                    onClick={() =>
                      void run(() => archiveMemberAction({ userId: open.id }), {
                        success: "Membre archivé et anonymisé.",
                        onSuccess: close,
                      })
                    }
                  >
                    {pending ? "Archivage…" : "Archiver définitivement"}
                  </Button>
                  <Button variant="contour" onClick={() => setMode("view")}>
                    Annuler
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        {open ? toast : null}
      </SidePanel>
      {open ? null : toast}
    </>
  );
}
