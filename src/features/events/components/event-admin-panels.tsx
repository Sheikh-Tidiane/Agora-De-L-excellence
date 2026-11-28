"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/page-header";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  archiveEventAction,
  promoteFromWaitlistAction,
  removeRegistrationAction,
  setEventStatusAction,
} from "@/features/events/admin-actions";
import { eventStatusTones } from "@/features/events/components/events-table";
import { recordAttendanceAction } from "@/features/payments/actions";
import { eventStatusLabels, type EventStatusCode } from "@/features/events/rules";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

const nextSteps: Record<
  EventStatusCode,
  { status: EventStatusCode; label: string; primary?: boolean }[]
> = {
  DRAFT: [{ status: "PUBLISHED", label: "Publier", primary: true }],
  PUBLISHED: [
    { status: "CLOSED", label: "Clôturer les inscriptions" },
    { status: "CANCELLED", label: "Annuler la rencontre" },
    { status: "DRAFT", label: "Repasser en brouillon" },
  ],
  CLOSED: [
    { status: "PUBLISHED", label: "Rouvrir les inscriptions", primary: true },
    { status: "CANCELLED", label: "Annuler la rencontre" },
  ],
  CANCELLED: [{ status: "PUBLISHED", label: "Republier", primary: true }],
};

const doneMessages: Record<EventStatusCode, string> = {
  PUBLISHED: "Événement publié : il est visible sur le site.",
  CLOSED: "Inscriptions clôturées.",
  CANCELLED: "Rencontre annulée. Elle reste affichée comme annulée.",
  DRAFT: "Événement repassé en brouillon : il n’est plus visible du public.",
};

/** Statut d'un événement et gestes possibles : publier, clôturer, annuler, archiver. */
export function EventStatusPanel({
  eventId,
  status,
  slug,
}: {
  eventId: string;
  status: EventStatusCode;
  slug: string;
}) {
  const router = useRouter();
  const { run, pending, toast } = useAdminAction();
  return (
    <section aria-labelledby="statut-titre" className="rounded-feuille bg-blanc p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="statut-titre" className="titre-3">
          Statut
        </h2>
        <StatusPill tone={eventStatusTones[status]}>{eventStatusLabels[status]}</StatusPill>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {nextSteps[status].map((step) => (
          <Button
            key={step.status}
            variant={step.primary ? "action" : "contour"}
            disabled={pending}
            onClick={() =>
              void run(() => setEventStatusAction({ eventId, status: step.status }), {
                success: doneMessages[step.status],
              })
            }
          >
            {step.label}
          </Button>
        ))}
        {status !== "DRAFT" ? (
          <a
            href={`/events/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="lien inline-flex min-h-11 items-center justify-center"
          >
            Voir la page publique
          </a>
        ) : null}
        <Button
          variant="discret"
          className="text-erreur hover:bg-erreur-fond"
          disabled={pending}
          onClick={() =>
            void run(() => archiveEventAction({ id: eventId }), {
              onSuccess: () => router.push("/admin/events"),
            })
          }
        >
          Archiver l’événement
        </Button>
      </div>
      {toast}
    </section>
  );
}

export type RegistrantRow = {
  id: string;
  name: string;
  email: string;
  kind: "member" | "guest";
  memberNumber: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  createdAt: Date;
  /** Présence pointée. */
  present: boolean;
  /** Participation à la séance encaissée. */
  paid: boolean;
  /** Accord pour les photos (membre) ; `null` : invité, accord non recueilli. */
  mediaConsent: boolean | null;
};

const statusLabels = {
  CONFIRMED: "Confirmée",
  PENDING: "À confirmer",
  CANCELLED: "Annulée",
} as const;
const statusTones = { CONFIRMED: "succes", PENDING: "alerte", CANCELLED: "neutre" } as const;

type Mark = { present: boolean; paid: boolean };

function CheckToggle({
  label,
  title,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  title?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      title={title}
      className={cn(
        "inline-flex h-11 cursor-pointer items-center gap-2 rounded-champ px-2.5 text-[0.9375rem] font-semibold select-none",
        checked ? "bg-succes-fond text-succes" : "hover:bg-indigo/5",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 rounded-[5px] accent-indigo"
      />
      {label}
    </label>
  );
}

/** Inscrits à un événement : pointage (présent, payé), export CSV et retrait d'une inscription. */
export function RegistrantsTable({
  eventId,
  rows,
  canExport,
  checkInOpen,
  canCheckIn,
  canCollect,
  sessionFee,
}: {
  eventId: string;
  rows: RegistrantRow[];
  canExport: boolean;
  /** Le pointage ouvre le jour de la rencontre. */
  checkInOpen: boolean;
  canCheckIn: boolean;
  canCollect: boolean;
  /** Montant de la participation, déjà formaté. */
  sessionFee: string;
}) {
  const { run, toast, notify, pending } = useAdminAction();
  // Coche immédiate : la case répond au doigt sans attendre le serveur (connexion lente),
  // puis la liste rafraîchie fait foi. En cas de refus, la case revient à son état réel.
  const [marks, setMarks] = useState<{ base: RegistrantRow[]; byId: Record<string, Mark> }>({
    base: rows,
    byId: {},
  });
  const optimistic = marks.base === rows ? marks.byId : {};
  const point = (row: RegistrantRow, next: Mark) => {
    setMarks({ base: rows, byId: { ...optimistic, [row.id]: next } });
    void run(() => recordAttendanceAction({ registrationId: row.id, ...next }), {}).then((done) => {
      if (done) return;
      setMarks((current) => {
        const byId = { ...current.byId };
        delete byId[row.id];
        return { base: current.base, byId };
      });
    });
  };
  /** Deux cases par inscrit : « présent » et « payé ». Cocher « payé » pointe aussi la présence. */
  const checks = (row: RegistrantRow) => {
    if (row.status !== "CONFIRMED") return null;
    const mark = optimistic[row.id] ?? { present: row.present, paid: row.paid };
    return (
      <span className="flex items-center gap-1">
        <CheckToggle
          label="Présent"
          checked={mark.present}
          disabled={pending || !canCheckIn || mark.paid}
          onChange={(present) => point(row, { present, paid: false })}
        />
        <CheckToggle
          label="Payé"
          title={`Participation de ${sessionFee}`}
          checked={mark.paid}
          disabled={pending || !canCollect || (!mark.present && !canCheckIn)}
          onChange={(paid) => point(row, { present: paid ? true : mark.present, paid })}
        />
      </span>
    );
  };
  const columns: Column<RegistrantRow>[] = [
    { key: "name", header: "Nom", cell: (row) => row.name, sort: (row) => row.name },
    {
      key: "kind",
      header: "Qualité",
      cell: (row) => (row.kind === "member" ? (row.memberNumber ?? "Membre") : "Invité"),
      sort: (row) => row.kind,
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
      header: "Inscrit le",
      cell: (row) => <span className="tabular-nums">{formatDateTime(row.createdAt)}</span>,
      sort: (row) => row.createdAt.getTime(),
      className: "max-lg:hidden",
    },
    {
      key: "photos",
      header: "Photos",
      cell: (row) =>
        row.mediaConsent === null ? (
          <span className="text-gris">Non demandé</span>
        ) : row.mediaConsent ? (
          "Accord"
        ) : (
          <StatusPill tone="alerte">Pas d’accord</StatusPill>
        ),
      sort: (row) => (row.mediaConsent === null ? 1 : row.mediaConsent ? 2 : 0),
      className: "max-lg:hidden",
    },
    {
      key: "status",
      header: "Statut",
      cell: (row) => (
        <StatusPill tone={statusTones[row.status]}>{statusLabels[row.status]}</StatusPill>
      ),
      sort: (row) => row.status,
    },
    ...(checkInOpen && (canCheckIn || canCollect)
      ? [
          {
            key: "checkin",
            header: "Pointage",
            cell: checks,
            sort: (row: RegistrantRow) => (row.paid ? 2 : row.present ? 1 : 0),
          } satisfies Column<RegistrantRow>,
        ]
      : []),
  ];

  const remove = async (ids: string[]) => {
    const results = await Promise.all(
      ids.map((registrationId) => run(() => removeRegistrationAction({ registrationId }), {})),
    );
    const ok = results.filter(Boolean).length;
    if (ok > 0)
      notify({
        tone: "succes",
        text: `${ok} inscription${ok > 1 ? "s" : ""} retirée${ok > 1 ? "s" : ""}.`,
      });
  };

  return (
    <>
      <DataTable
        label="Inscrits"
        rows={rows}
        columns={columns}
        getId={(row) => row.id}
        searchText={(row) => `${row.name} ${row.email}`}
        searchPlaceholder="Nom ou e-mail…"
        filters={[
          {
            key: "status",
            label: "Statut",
            get: (row) => row.status,
            options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
          },
        ]}
        defaultSort={{ key: "name", direction: "asc" }}
        selectable={(row) => row.status !== "CANCELLED"}
        bulkActions={[{ label: "Retirer l’inscription", run: remove }]}
        actions={
          canExport && rows.length > 0 ? (
            <a
              href={`/api/admin/events/${eventId}/registrations`}
              className={cn(buttonVariants({ variant: "contour", size: "sm" }))}
            >
              <Download aria-hidden="true" />
              Exporter en CSV
            </a>
          ) : null
        }
        card={(row) => (
          <>
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold">{row.name}</span>
              <StatusPill tone={statusTones[row.status]}>{statusLabels[row.status]}</StatusPill>
            </span>
            <span className="petit mt-1 block text-gris">
              {row.kind === "member" ? (row.memberNumber ?? "Membre") : "Invité"} · {row.email}
            </span>
            {checkInOpen && (canCheckIn || canCollect) ? (
              <span className="relative z-10 mt-2 block">{checks(row)}</span>
            ) : null}
          </>
        )}
        empty={<p className="py-6 text-gris">Personne n’est encore inscrit à cette rencontre.</p>}
      />
      {toast}
    </>
  );
}

export type WaitlistRow = {
  id: string;
  name: string;
  email: string;
  kind: "member" | "guest";
  /** Rang ; `null` : invité qui n'a pas encore confirmé son adresse. */
  position: number | null;
  since: Date | null;
  /** Ne recevra pas de place (compte inactif, rencontre réservée aux membres). */
  blocked: string | null;
};

/**
 * Liste d'attente d'une rencontre, dans l'ordre. « Inscrire » donne une place à la personne,
 * quel que soit son rang ; si la rencontre est complète, une seconde pression confirme le
 * dépassement de la capacité.
 */
export function WaitlistPanel({ rows, full }: { rows: WaitlistRow[]; full: boolean }) {
  const { run, toast, pending } = useAdminAction();
  const [armed, setArmed] = useState<string | null>(null);
  if (rows.length === 0) {
    return <p className="text-gris">Personne n’attend une place.</p>;
  }
  const promote = (row: WaitlistRow) => {
    if (full && armed !== row.id) {
      setArmed(row.id);
      return;
    }
    const force = armed === row.id;
    setArmed(null);
    void run(() => promoteFromWaitlistAction({ registrationId: row.id, force }), {
      success: `${row.name} est inscrit${force ? " (au-delà de la capacité)" : ""} et prévenu par e-mail.`,
    }).then((done) => {
      // La rencontre s'est remplie entre l'affichage et le clic : seconde pression pour confirmer.
      if (!done && !force) setArmed(row.id);
    });
  };
  return (
    <>
      <ol className="divide-y divide-trait border-y border-trait" aria-label="Liste d’attente">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <span className="w-10 shrink-0 font-serif text-[1.5rem] leading-none text-indigo tabular-nums">
              {row.position ?? "–"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold break-words">{row.name}</span>
              <span className="petit block break-all text-gris">
                {row.kind === "member" ? "Membre" : "Invité"} · {row.email}
              </span>
              <span className="petit block text-gris">
                {row.blocked
                  ? row.blocked
                  : row.since
                    ? `En attente depuis le ${formatDateTime(row.since)}`
                    : "Adresse e-mail pas encore confirmée : pas de rang"}
              </span>
            </span>
            {row.position !== null ? (
              <Button
                variant={armed === row.id ? "action" : "contour"}
                size="md"
                disabled={pending}
                onClick={() => promote(row)}
                className="max-sm:w-full"
              >
                {armed === row.id ? "Confirmer : dépasser la capacité" : "Inscrire"}
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
      {toast}
    </>
  );
}
