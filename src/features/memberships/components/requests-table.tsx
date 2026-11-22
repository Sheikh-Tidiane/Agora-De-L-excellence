"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/page-header";
import { PanelRow, SidePanel } from "@/components/admin/side-panel";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { approveRequestsAction, rejectRequestAction } from "@/features/memberships/actions";
import {
  ageRangeLabels,
  interestLabels,
  isMinor,
  occupationLabels,
} from "@/features/memberships/schemas";
import { formatDateTime, formatShortDate } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";

export type RequestRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  ageRange: keyof typeof ageRangeLabels;
  occupation: keyof typeof occupationLabels;
  interests: (keyof typeof interestLabels)[];
  motivation: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  reviewedAt: Date | null;
  reviewerName: string | null;
  rejectionReason: string | null;
};

const statusLabels = { PENDING: "En attente", APPROVED: "Validée", REJECTED: "Refusée" } as const;
const statusTones = { PENDING: "alerte", APPROVED: "succes", REJECTED: "neutre" } as const;

const Status = ({ status }: { status: RequestRow["status"] }) => (
  <StatusPill tone={statusTones[status]}>{statusLabels[status]}</StatusPill>
);

const columns: Column<RequestRow>[] = [
  {
    key: "name",
    header: "Demandeur",
    cell: (row) => `${row.firstName} ${row.lastName}`,
    sort: (row) => `${row.lastName} ${row.firstName}`,
  },
  {
    key: "email",
    header: "E-mail",
    cell: (row) => row.email,
    sort: (row) => row.email,
    className: "max-xl:hidden text-gris",
  },
  {
    key: "age",
    header: "Âge",
    cell: (row) => ageRangeLabels[row.ageRange],
    sort: (row) => row.ageRange,
  },
  {
    key: "occupation",
    header: "Situation",
    cell: (row) => occupationLabels[row.occupation],
    sort: (row) => row.occupation,
    className: "max-lg:hidden",
  },
  {
    key: "createdAt",
    header: "Reçue le",
    cell: (row) => <span className="tabular-nums">{formatShortDate(row.createdAt)}</span>,
    sort: (row) => row.createdAt.getTime(),
  },
  {
    key: "status",
    header: "Statut",
    cell: (row) => <Status status={row.status} />,
    sort: (row) => row.status,
  },
];

/** Demandes d'adhésion : liste triable, validation groupée, fiche et décision dans un panneau. */
export function RequestsTable({
  rows,
  initialOpenId,
}: {
  rows: RequestRow[];
  initialOpenId?: string;
}) {
  const { run, pending, toast } = useAdminAction();
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const open = rows.find((row) => row.id === openId) ?? null;

  const close = () => {
    setOpenId(null);
    setRejecting(false);
    setReason("");
  };

  const approve = (ids: string[]) =>
    run(() => approveRequestsAction({ ids }), {
      success: (outcome) =>
        outcome.note ??
        (outcome.failed.length > 0
          ? `${outcome.done} demande(s) validée(s), ${outcome.failed.length} en échec : ${outcome.failed[0]!.message}`
          : outcome.done > 1
            ? `${outcome.done} demandes validées. Les liens d’activation sont partis.`
            : "Demande validée. Le lien d’activation est parti par e-mail."),
      onSuccess: close,
    });

  const reject = (id: string) =>
    run(() => rejectRequestAction({ id, reason }), {
      success: (result) =>
        result.emailSent
          ? "Demande refusée. Le demandeur est prévenu par e-mail."
          : "Demande refusée, mais l’e-mail n’a pas pu partir.",
      onSuccess: close,
    });

  return (
    <>
      <DataTable
        label="Demandes d’adhésion"
        rows={rows}
        columns={columns}
        getId={(row) => row.id}
        searchText={(row) => `${row.firstName} ${row.lastName} ${row.email}`}
        searchPlaceholder="Nom ou e-mail…"
        filters={[
          {
            key: "status",
            label: "Statut",
            initial: initialOpenId ? "" : "PENDING",
            get: (row) => row.status,
            options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
          },
          {
            key: "age",
            label: "Âge",
            get: (row) => row.ageRange,
            options: Object.entries(ageRangeLabels).map(([value, label]) => ({ value, label })),
          },
        ]}
        defaultSort={{ key: "createdAt", direction: "asc" }}
        onOpen={(row) => setOpenId(row.id)}
        selectable={(row) => row.status === "PENDING"}
        bulkActions={[
          { label: "Valider la sélection", run: async (ids) => void (await approve(ids)) },
        ]}
        card={(row) => (
          <>
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold">
                {row.firstName} {row.lastName}
              </span>
              <Status status={row.status} />
            </span>
            <span className="petit mt-1 block text-gris">
              {ageRangeLabels[row.ageRange]} · {occupationLabels[row.occupation]} · reçue le{" "}
              {formatShortDate(row.createdAt)}
            </span>
          </>
        )}
        empty={
          <EmptyState title="Aucune demande ici">
            Les demandes envoyées depuis la page Adhérer du site arrivent dans cette liste.
          </EmptyState>
        }
      />

      <SidePanel
        open={open !== null}
        onClose={close}
        surtitre="Demande d’adhésion"
        title={open ? `${open.firstName} ${open.lastName}` : ""}
        footer={
          open?.status === "PENDING" ? (
            rejecting ? (
              <div className="flex gap-2">
                <Button
                  variant="principal"
                  className="flex-1"
                  disabled={pending}
                  onClick={() => void reject(open.id)}
                >
                  {pending ? "Envoi…" : "Confirmer le refus"}
                </Button>
                <Button variant="contour" disabled={pending} onClick={() => setRejecting(false)}>
                  Retour
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="action"
                  className="flex-1"
                  disabled={pending}
                  onClick={() => void approve([open.id])}
                >
                  {pending ? "Validation…" : "Valider l’adhésion"}
                </Button>
                <Button variant="contour" disabled={pending} onClick={() => setRejecting(true)}>
                  Refuser
                </Button>
              </div>
            )
          ) : undefined
        }
      >
        {open ? (
          <>
            <div className="mb-4 flex items-center gap-3">
              <Status status={open.status} />
              <span className="petit text-gris">Reçue le {formatDateTime(open.createdAt)}</span>
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
              <PanelRow label="Tranche d’âge">{ageRangeLabels[open.ageRange]}</PanelRow>
              <PanelRow label="Situation">{occupationLabels[open.occupation]}</PanelRow>
              <PanelRow label="Centres d’intérêt">
                {open.interests.map((interest) => interestLabels[interest]).join(", ")}
              </PanelRow>
              {isMinor(open.ageRange) ? (
                <>
                  <PanelRow label="Parent ou tuteur">{open.guardianName}</PanelRow>
                  <PanelRow label="Tél. du tuteur">
                    {open.guardianPhone ? (
                      <a href={`tel:${open.guardianPhone}`} className="lien">
                        {formatPhone(open.guardianPhone)}
                      </a>
                    ) : null}
                  </PanelRow>
                </>
              ) : null}
              <PanelRow label="Traitée le">
                {open.reviewedAt
                  ? `${formatDateTime(open.reviewedAt)}${open.reviewerName ? `, par ${open.reviewerName}` : ""}`
                  : null}
              </PanelRow>
              <PanelRow label="Motif du refus">{open.rejectionReason}</PanelRow>
            </dl>
            {open.motivation ? (
              <div className="mt-5">
                <p className="surtitre">Son mot</p>
                <p className="mt-2 font-serif text-lg leading-snug">« {open.motivation} »</p>
              </div>
            ) : null}

            {open.status === "PENDING" && !rejecting ? (
              <p className="petit mt-6 rounded-champ bg-sable px-4 py-3">
                Valider crée le compte, attribue un numéro de membre et envoie le lien d’activation
                à cette adresse.
              </p>
            ) : null}

            {rejecting ? (
              <div className="mt-6">
                <label htmlFor="motif" className="mb-1.5 block text-[0.9375rem] font-semibold">
                  Un mot pour le demandeur{" "}
                  <span className="font-normal text-gris">(facultatif)</span>
                </label>
                <Textarea
                  id="motif"
                  rows={4}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  aria-describedby="motif-aide"
                />
                <p id="motif-aide" className="petit mt-1.5 text-gris">
                  Il sera repris tel quel dans l’e-mail de réponse.
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </SidePanel>
      {toast}
    </>
  );
}
