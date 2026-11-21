"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/page-header";
import { SidePanel } from "@/components/admin/side-panel";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { CheckboxField, TextField } from "@/components/shared/form-fields";
import { EmptyState } from "@/components/shared/states";
import { useActionForm } from "@/components/shared/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/features/auth/components/form-parts";
import { createStaffAccountAction, setUserRolesAction } from "@/features/auth/roles-actions";
import { staffAccountSchema } from "@/features/auth/roles-schemas";

export type TeamRow = {
  id: string;
  name: string;
  email: string;
  status: "PENDING_ACTIVATION" | "ACTIVE" | "SUSPENDED";
  roles: string[];
  isSelf: boolean;
};

export type RoleOption = { code: string; name: string; description: string; staff: boolean };

const statusLabels = {
  ACTIVE: "Actif",
  PENDING_ACTIVATION: "À activer",
  SUSPENDED: "Suspendu",
} as const;
const statusTones = {
  ACTIVE: "succes",
  PENDING_ACTIVATION: "alerte",
  SUSPENDED: "erreur",
} as const;

function CreateForm({ roles, onDone }: { roles: RoleOption[]; onDone: (message: string) => void }) {
  const { form, pending, formError, submit } = useActionForm({
    schema: staffAccountSchema,
    defaultValues: { firstName: "", lastName: "", email: "", roles: [] },
    action: createStaffAccountAction,
    onSuccess: (data) =>
      onDone(
        data.emailSent
          ? "Compte créé. Le lien d’activation est parti par e-mail."
          : "Compte créé, mais l’e-mail d’activation n’a pas pu partir.",
      ),
  });
  const rolesError = form.formState.errors.roles?.message as string | undefined;
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <FormError message={formError} />
      <TextField form={form} name="firstName" idPrefix="eq" label="Prénom" autoComplete="off" />
      <TextField form={form} name="lastName" idPrefix="eq" label="Nom" autoComplete="off" />
      <TextField
        form={form}
        name="email"
        idPrefix="eq"
        label="Adresse e-mail"
        type="email"
        autoComplete="off"
        hint="Le responsable y reçoit un lien pour choisir son mot de passe."
      />
      <fieldset>
        <legend className="text-[0.9375rem] font-semibold">Rôles</legend>
        {roles.map((role) => (
          <CheckboxField key={role.code} form={form} name="roles" value={role.code} idPrefix="eq">
            <span className="font-semibold">{role.name}</span>
            <span className="petit block text-gris">{role.description}</span>
          </CheckboxField>
        ))}
        {rolesError ? <p className="petit font-semibold text-erreur">{rolesError}</p> : null}
      </fieldset>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer le compte"}
        </Button>
      </div>
    </form>
  );
}

/** Équipe et rôles : comptes des responsables, attribution du moindre privilège. */
export function TeamManager({ rows, roles }: { rows: TeamRow[]; roles: RoleOption[] }) {
  const { run, pending, toast } = useAdminAction();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const open = rows.find((row) => row.id === openId) ?? null;
  const roleName = (code: string) => roles.find((role) => role.code === code)?.name ?? code;

  const columns: Column<TeamRow>[] = [
    { key: "name", header: "Compte", cell: (row) => row.name, sort: (row) => row.name },
    {
      key: "email",
      header: "E-mail",
      cell: (row) => row.email,
      sort: (row) => row.email,
      className: "max-lg:hidden text-gris",
    },
    {
      key: "roles",
      header: "Rôles",
      cell: (row) => row.roles.map(roleName).join(", "),
      sort: (row) => row.roles.length,
    },
    {
      key: "status",
      header: "État",
      cell: (row) => (
        <StatusPill tone={statusTones[row.status]}>{statusLabels[row.status]}</StatusPill>
      ),
      sort: (row) => row.status,
    },
  ];

  return (
    <>
      <DataTable
        label="Équipe"
        rows={rows}
        columns={columns}
        getId={(row) => row.id}
        searchText={(row) => `${row.name} ${row.email}`}
        searchPlaceholder="Nom ou e-mail…"
        defaultSort={{ key: "name", direction: "asc" }}
        onOpen={(row) => {
          setDraft(row.roles);
          setOpenId(row.id);
        }}
        actions={
          <Button size="sm" data-shortcut-new onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Nouveau responsable
          </Button>
        }
        card={(row) => (
          <>
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold">{row.name}</span>
              <StatusPill tone={statusTones[row.status]}>{statusLabels[row.status]}</StatusPill>
            </span>
            <span className="petit mt-1 block text-gris">{row.roles.map(roleName).join(", ")}</span>
          </>
        )}
        empty={<EmptyState title="Aucun compte ici" />}
      />

      <SidePanel
        open={open !== null}
        onClose={() => setOpenId(null)}
        surtitre="Rôles"
        title={open?.name ?? ""}
        footer={
          open ? (
            <Button
              className="w-full"
              disabled={pending}
              onClick={() =>
                void run(() => setUserRolesAction({ userId: open.id, roles: draft }), {
                  success: (data) =>
                    data.added.length + data.removed.length > 0
                      ? "Rôles mis à jour. Le changement est consigné au journal."
                      : "Aucun changement.",
                  onSuccess: () => setOpenId(null),
                })
              }
            >
              {pending ? "Enregistrement…" : "Enregistrer les rôles"}
            </Button>
          ) : undefined
        }
      >
        {open ? (
          <>
            <p className="petit mb-4 text-gris">
              {open.email}
              {open.isSelf ? " · votre compte" : ""}
            </p>
            <fieldset>
              <legend className="sr-only">Rôles de {open.name}</legend>
              {roles.map((role) => (
                <label
                  key={role.code}
                  className="flex min-h-11 cursor-pointer items-start gap-3 border-b border-trait py-3"
                >
                  <input
                    type="checkbox"
                    checked={draft.includes(role.code)}
                    onChange={(event) =>
                      setDraft((current) =>
                        event.target.checked
                          ? [...current, role.code]
                          : current.filter((code) => code !== role.code),
                      )
                    }
                    className="mt-0.5 size-5 shrink-0 accent-indigo"
                  />
                  <span>
                    <span className="block text-[0.9375rem] font-semibold">{role.name}</span>
                    <span className="petit block text-gris">{role.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="petit mt-5 rounded-champ bg-sable px-4 py-3">
              N’attribuez que les rôles nécessaires. Un compte sans aucun rôle de responsable quitte
              cette liste.
            </p>
          </>
        ) : null}
      </SidePanel>

      <SidePanel
        open={creating}
        onClose={() => setCreating(false)}
        surtitre="Équipe"
        title="Nouveau responsable"
      >
        {creating ? (
          <CreateForm
            roles={roles.filter((role) => role.staff)}
            onDone={(message) => {
              setCreating(false);
              void run(async () => ({ ok: true as const, data: undefined }), { success: message });
            }}
          />
        ) : null}
      </SidePanel>
      {toast}
    </>
  );
}
