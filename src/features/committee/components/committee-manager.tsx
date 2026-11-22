"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { SidePanel } from "@/components/admin/side-panel";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { TextField, TextareaField } from "@/components/shared/form-fields";
import { EmptyState } from "@/components/shared/states";
import { useActionForm } from "@/components/shared/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/features/auth/components/form-parts";
import {
  moveCommitteeMemberAction,
  removeCommitteeMemberAction,
  saveCommitteeMemberAction,
} from "@/features/committee/actions";
import {
  committeeMemberSchema,
  initials,
  type CommitteeMemberView,
} from "@/features/committee/schemas";
import { CoverUpload } from "@/features/library/components/cover-upload";
import { uploadUrl } from "@/lib/storage-names";

function MemberForm({
  member,
  onSaved,
  onCancel,
}: {
  member: CommitteeMemberView | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [photo, setPhoto] = useState(member?.photo ?? "");
  const { form, pending, formError, submit } = useActionForm({
    schema: committeeMemberSchema,
    defaultValues: {
      id: member?.id ?? "",
      name: member?.name ?? "",
      role: member?.role ?? "",
      bio: member?.bio ?? "",
      photo: member?.photo ?? "",
    },
    action: (values) => saveCommitteeMemberAction({ ...values, photo }),
    onSuccess: onSaved,
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <FormError message={formError} />
      <TextField form={form} name="name" idPrefix="comite" label="Nom" autoComplete="off" />
      <TextField
        form={form}
        name="role"
        idPrefix="comite"
        label="Rôle"
        optional
        autoComplete="off"
        hint="Affiché sous le nom. Laissez vide tant qu’il n’est pas arrêté."
      />
      <TextareaField
        form={form}
        name="bio"
        idPrefix="comite"
        label="Courte biographie"
        optional
        rows={4}
        hint="Deux ou trois phrases, 600 caractères au plus."
      />
      <CoverUpload
        value={photo}
        onChange={setPhoto}
        folder="committee"
        label="Photo"
        emptyLabel="Initiales"
        square
      />
      <p className="petit -mt-3 text-gris">
        Sans photo, le site affiche les initiales. N’envoyez qu’une photo que la personne a
        acceptée.
      </p>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button variant="contour" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

/** Comité de pilotage : la liste ordonnée telle qu'elle paraît sur la page « Le club ». */
export function CommitteeManager({ members }: { members: CommitteeMemberView[] }) {
  const { run, pending, toast } = useAdminAction();
  const [editing, setEditing] = useState<CommitteeMemberView | "new" | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const item = editing === "new" ? null : editing;

  return (
    <div className="max-w-[60rem]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-gris tabular-nums">
          {members.length} membre{members.length > 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus aria-hidden="true" />
          Ajouter un membre
        </Button>
      </div>

      {members.length === 0 ? (
        <EmptyState title="Le comité n’est pas renseigné">
          Tant que la liste est vide, la section « Comité de pilotage » n’apparaît pas sur le site.
        </EmptyState>
      ) : (
        <ol className="border-b border-indigo/20">
          {members.map((member, i) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-indigo/20 py-3"
            >
              <span className="w-6 font-serif text-xl text-gris tabular-nums">{i + 1}</span>
              {member.photo ? (
                <Image
                  src={uploadUrl(member.photo)}
                  alt=""
                  width={48}
                  height={48}
                  className="size-12 rounded-champ object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid size-12 place-items-center rounded-champ bg-indigo font-serif text-lg text-ivoire"
                >
                  {initials(member.name)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{member.name}</p>
                <p className="petit text-gris">
                  {member.role ?? "Rôle non renseigné"}
                  {member.bio ? " · biographie" : ""}
                  {member.photo ? " · photo" : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="discret"
                  size="icone"
                  disabled={pending || i === 0}
                  onClick={() =>
                    void run(() => moveCommitteeMemberAction({ id: member.id, direction: "up" }))
                  }
                >
                  <ArrowUp aria-hidden="true" />
                  <span className="sr-only">Monter {member.name}</span>
                </Button>
                <Button
                  variant="discret"
                  size="icone"
                  disabled={pending || i === members.length - 1}
                  onClick={() =>
                    void run(() => moveCommitteeMemberAction({ id: member.id, direction: "down" }))
                  }
                >
                  <ArrowDown aria-hidden="true" />
                  <span className="sr-only">Descendre {member.name}</span>
                </Button>
                <Button variant="contour" size="sm" onClick={() => setEditing(member)}>
                  Modifier
                </Button>
                {removing === member.id ? (
                  <Button
                    size="sm"
                    className="bg-erreur hover:bg-erreur"
                    disabled={pending}
                    onClick={() =>
                      void run(() => removeCommitteeMemberAction({ id: member.id }), {
                        success: `${member.name} ne figure plus dans le comité.`,
                        onSuccess: () => setRemoving(null),
                      })
                    }
                  >
                    Confirmer le retrait
                  </Button>
                ) : (
                  <Button
                    variant="discret"
                    size="sm"
                    className="text-erreur hover:bg-erreur-fond"
                    onClick={() => setRemoving(member.id)}
                  >
                    Retirer
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <SidePanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        surtitre="Comité de pilotage"
        title={item ? item.name : "Nouveau membre"}
      >
        {editing !== null ? (
          <MemberForm
            key={item?.id ?? "new"}
            member={item}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              void run(async () => ({ ok: true as const, data: undefined }), {
                success: "Comité enregistré. La page « Le club » est à jour.",
              });
            }}
          />
        ) : null}
      </SidePanel>
      {toast}
    </div>
  );
}
