"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/page-header";
import { PanelRow, SidePanel } from "@/components/admin/side-panel";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { EmptyState } from "@/components/shared/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { setContactMessageStatusAction } from "@/features/contact/actions";
import {
  contactStatusLabels,
  contactStatuses,
  type ContactStatus,
} from "@/features/contact/schemas";
import { formatDateTime, formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type MessageRow = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  emailSent: boolean;
  createdAt: Date;
  handledAt: Date | null;
  handlerName: string | null;
};

const statusTones = { NEW: "accent", READ: "neutre", HANDLED: "succes" } as const;

const Status = ({ status }: { status: ContactStatus }) => (
  <StatusPill tone={statusTones[status]}>{contactStatusLabels[status]}</StatusPill>
);

/** Lien « Répondre » : objet repris, adresse validée à l'envoi du formulaire. */
const replyHref = (row: MessageRow) =>
  `mailto:${row.email}?subject=${encodeURIComponent(`Re : ${row.subject}`)}`;

const columns: Column<MessageRow>[] = [
  {
    key: "name",
    header: "Expéditeur",
    cell: (row) => <span className={cn(row.status === "NEW" && "font-semibold")}>{row.name}</span>,
    sort: (row) => row.name,
  },
  {
    key: "subject",
    header: "Objet",
    cell: (row) => (
      <span className={cn("line-clamp-1", row.status === "NEW" && "font-semibold")}>
        {row.subject}
      </span>
    ),
    sort: (row) => row.subject,
  },
  {
    key: "email",
    header: "E-mail",
    cell: (row) => row.email,
    sort: (row) => row.email,
    className: "max-xl:hidden text-gris",
  },
  {
    key: "createdAt",
    header: "Reçu le",
    cell: (row) => <span className="tabular-nums">{formatShortDate(row.createdAt)}</span>,
    sort: (row) => row.createdAt.getTime(),
  },
  {
    key: "status",
    header: "Statut",
    cell: (row) => <Status status={row.status} />,
    sort: (row) => contactStatuses.indexOf(row.status),
  },
];

/** Messages du formulaire de contact : liste triable et filtrable, lecture et suivi dans un panneau. */
export function MessagesTable({
  rows,
  initialOpenId,
}: {
  rows: MessageRow[];
  initialOpenId?: string;
}) {
  const { run, pending, toast } = useAdminAction();
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const open = rows.find((row) => row.id === openId) ?? null;

  const setStatus = (id: string, status: ContactStatus, success?: string) =>
    run(() => setContactMessageStatusAction({ id, status }), { success });

  const openMessage = (row: MessageRow) => {
    setOpenId(row.id);
    // Ouvrir un nouveau message le marque comme lu.
    if (row.status === "NEW") void setStatus(row.id, "READ");
  };

  const handleMany = async (ids: string[]) => {
    await run(
      async () => {
        let done = 0;
        for (const id of ids) {
          if ((await setContactMessageStatusAction({ id, status: "HANDLED" })).ok) done++;
        }
        return { ok: true as const, data: done };
      },
      {
        success: (done) =>
          done === ids.length
            ? done > 1
              ? `${done} messages marqués comme traités.`
              : "Message marqué comme traité."
            : `${done} sur ${ids.length} marqués comme traités. Réessayez pour les autres.`,
      },
    );
  };

  return (
    <>
      <DataTable
        label="Messages de contact"
        rows={rows}
        columns={columns}
        getId={(row) => row.id}
        searchText={(row) => `${row.name} ${row.email} ${row.subject}`}
        searchPlaceholder="Nom, e-mail ou objet…"
        filters={[
          {
            key: "status",
            label: "Statut",
            initial: "",
            get: (row) => row.status,
            options: contactStatuses.map((value) => ({
              value,
              label: contactStatusLabels[value],
            })),
          },
        ]}
        defaultSort={{ key: "createdAt", direction: "desc" }}
        onOpen={openMessage}
        selectable={(row) => row.status !== "HANDLED"}
        bulkActions={[{ label: "Marquer comme traités", run: handleMany }]}
        card={(row) => (
          <>
            <span className="flex items-center justify-between gap-3">
              <span className={cn("min-w-0 truncate", row.status === "NEW" && "font-semibold")}>
                {row.name}
              </span>
              <Status status={row.status} />
            </span>
            <span className="mt-1 line-clamp-1 block text-[0.9375rem]">{row.subject}</span>
            <span className="petit mt-0.5 block text-gris">
              Reçu le {formatShortDate(row.createdAt)}
            </span>
          </>
        )}
        empty={
          <EmptyState title="Aucun message ici">
            Les messages envoyés depuis la page Contact du site arrivent dans cette liste.
          </EmptyState>
        }
      />

      <SidePanel
        open={open !== null}
        onClose={() => setOpenId(null)}
        surtitre="Message de contact"
        title={open?.subject ?? ""}
        wide
        footer={
          open ? (
            <div className="flex flex-wrap gap-2">
              <a
                href={replyHref(open)}
                className={cn(
                  buttonVariants({ variant: "action" }),
                  "flex-1 gap-2 max-sm:basis-full",
                )}
              >
                <Mail aria-hidden className="size-4" />
                Répondre par e-mail
              </a>
              {open.status === "HANDLED" ? (
                <Button
                  variant="contour"
                  className="max-sm:flex-1"
                  disabled={pending}
                  onClick={() => void setStatus(open.id, "READ", "Message rouvert.")}
                >
                  Rouvrir
                </Button>
              ) : (
                <Button
                  variant="principal"
                  className="max-sm:flex-1"
                  disabled={pending}
                  onClick={() => void setStatus(open.id, "HANDLED", "Message marqué comme traité.")}
                >
                  {pending ? "Enregistrement…" : "Marquer comme traité"}
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {open ? (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div role="radiogroup" aria-label="Statut du message" className="flex gap-1.5">
                {contactStatuses.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={open.status === value}
                    disabled={pending}
                    onClick={() => {
                      if (open.status !== value) void setStatus(open.id, value);
                    }}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-full border px-4 text-[0.9375rem] font-semibold transition-colors lg:min-h-9",
                      open.status === value
                        ? "border-indigo bg-indigo text-ivoire"
                        : "border-indigo/20 hover:border-indigo",
                    )}
                  >
                    {contactStatusLabels[value]}
                  </button>
                ))}
              </div>
            </div>
            <dl className="border-t border-trait">
              <PanelRow label="De">{open.name}</PanelRow>
              <PanelRow label="E-mail">
                <a href={replyHref(open)} className="lien break-all">
                  {open.email}
                </a>
              </PanelRow>
              <PanelRow label="Reçu le">{formatDateTime(open.createdAt)}</PanelRow>
              <PanelRow label="Traité le">
                {open.handledAt
                  ? `${formatDateTime(open.handledAt)}${open.handlerName ? `, par ${open.handlerName}` : ""}`
                  : null}
              </PanelRow>
            </dl>
            <div className="mt-6">
              <p className="surtitre">Message</p>
              <p className="mt-3 max-w-[65ch] text-[1.0625rem] leading-relaxed whitespace-pre-line">
                {open.message}
              </p>
            </div>
            {!open.emailSent ? (
              <p className="petit mt-6 rounded-champ bg-sable px-4 py-3">
                L’e-mail de notification au club n’est pas parti pour ce message : il n’est
                consultable qu’ici.
              </p>
            ) : null}
            {open.status === "HANDLED" ? (
              <p className="petit mt-6 text-gris">
                Les messages traités sont supprimés douze mois après leur traitement.
              </p>
            ) : null}
          </>
        ) : null}
      </SidePanel>
      {toast}
    </>
  );
}
