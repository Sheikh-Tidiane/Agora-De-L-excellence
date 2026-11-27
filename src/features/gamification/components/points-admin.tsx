"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  awardManualBadgeAction,
  grantManualPointsAction,
  reversePointTransactionAction,
  setAttendancePointModeAction,
  updatePointRuleAction,
} from "@/features/gamification/actions";
import type { ActionResult } from "@/lib/errors";

/** Envoi d'une action d'administration, avec message de réussite ou d'erreur et rafraîchissement. */
function useAdminSubmit() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const run = (call: () => Promise<ActionResult<unknown>>, success: string, onOk?: () => void) =>
    start(async () => {
      setMessage(undefined);
      const result = await call();
      if (result.ok) {
        setMessage({ ok: true, text: success });
        onOk?.();
        router.refresh();
      } else {
        const field = result.fieldErrors ? Object.values(result.fieldErrors)[0] : undefined;
        setMessage({ ok: false, text: field ?? result.message });
      }
    });
  const feedback = message ? (
    <p
      role={message.ok ? "status" : "alert"}
      className={`petit font-semibold ${message.ok ? "text-succes" : "text-erreur"}`}
    >
      {message.text}
    </p>
  ) : null;
  return { pending, run, feedback };
}

/** Une règle du barème : points et activation, enregistrées ensemble. */
export function RuleEditor({
  rule,
}: {
  rule: { id: string; label: string; points: number; isActive: boolean };
}) {
  const [points, setPoints] = useState(String(rule.points));
  const [active, setActive] = useState(rule.isActive);
  const { pending, run, feedback } = useAdminSubmit();
  const dirty = points !== String(rule.points) || active !== rule.isActive;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="sr-only" htmlFor={`regle-${rule.id}`}>
        Points de « {rule.label} »
      </label>
      <Input
        id={`regle-${rule.id}`}
        inputMode="numeric"
        value={points}
        onChange={(event) => setPoints(event.target.value.replace(/[^0-9]/g, ""))}
        className="h-11 w-24 text-right tabular-nums"
      />
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[0.9375rem]">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          className="size-5 accent-indigo"
        />
        Active
      </label>
      <Button
        size="sm"
        variant={dirty ? "principal" : "contour"}
        disabled={pending || !dirty}
        onClick={() =>
          run(
            () => updatePointRuleAction({ id: rule.id, points: Number(points), isActive: active }),
            "Règle enregistrée.",
          )
        }
      >
        {pending ? "…" : "Enregistrer"}
      </Button>
      {feedback}
    </div>
  );
}

const attendanceModes = [
  {
    value: "ALL_ACTIVITIES",
    label: "Chaque activité de la rencontre",
    hint: "Une rencontre lecture et quiz rapporte les points des deux.",
  },
  {
    value: "PRIMARY_ONLY",
    label: "L’activité principale seulement",
    hint: "La même rencontre ne rapporte que les points de son activité principale.",
  },
] as const;

/** Règle des points de présence pour une rencontre qui réunit plusieurs activités. */
export function AttendanceModeEditor({ mode }: { mode: "ALL_ACTIVITIES" | "PRIMARY_ONLY" }) {
  const [value, setValue] = useState<string>(mode);
  const { pending, run, feedback } = useAdminSubmit();
  return (
    <fieldset>
      <legend className="font-semibold">Présence à une rencontre à plusieurs activités</legend>
      <div className="mt-2 flex flex-col">
        {attendanceModes.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5 text-[0.9375rem]"
          >
            <input
              type="radio"
              name="points-presence"
              value={option.value}
              checked={value === option.value}
              onChange={() => setValue(option.value)}
              className="mt-1 size-5 accent-indigo"
            />
            <span>
              {option.label}
              <span className="petit block text-gris">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="petit mt-2 text-gris">
        Vaut pour les présences pointées ensuite. Les points déjà attribués ne changent pas ; une
        présence décochée puis recochée suit la règle du moment.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant={value !== mode ? "principal" : "contour"}
          disabled={pending || value === mode}
          onClick={() =>
            run(() => setAttendancePointModeAction({ mode: value }), "Règle enregistrée.")
          }
        >
          {pending ? "…" : "Enregistrer"}
        </Button>
        {feedback}
      </div>
    </fieldset>
  );
}

/** Choix du membre dont on consulte et ajuste les points. */
export function MemberPicker({
  members,
  selected,
}: {
  members: { id: string; label: string }[];
  selected: string | null;
}) {
  const router = useRouter();
  return (
    <Field id="membre-points" label="Membre">
      <Select
        id="membre-points"
        value={selected ?? ""}
        onChange={(event) =>
          router.push(
            event.target.value ? `/admin/points?membre=${event.target.value}` : "/admin/points",
          )
        }
      >
        <option value="">Choisir un membre…</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Ajustement manuel motivé (positif ou négatif). */
export function GrantPointsForm({ userId }: { userId: string }) {
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const { pending, run, feedback } = useAdminSubmit();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    run(
      () => grantManualPointsAction({ userId, points: Number(points), reason }),
      "Ajustement enregistré.",
      () => {
        setPoints("");
        setReason("");
      },
    );
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 [&>*:first-child]:max-w-36">
        <Field id="ajust-points" label="Points" hint="Négatif pour retirer.">
          <Input
            id="ajust-points"
            inputMode="numeric"
            value={points}
            onChange={(event) => setPoints(event.target.value.replace(/[^0-9-]/g, ""))}
          />
        </Field>
        <Field id="ajust-motif" label="Motif" hint="Lu par le membre dans son historique.">
          <Input
            id="ajust-motif"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Enregistrement…" : "Ajuster les points"}
        </Button>
        {feedback}
      </div>
    </form>
  );
}

/** Correction d'une ligne : une transaction inverse, motivée. */
export function ReverseLine({ transactionId }: { transactionId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { pending, run, feedback } = useAdminSubmit();
  if (!open) {
    return (
      <Button size="sm" variant="discret" onClick={() => setOpen(true)}>
        Corriger
      </Button>
    );
  }
  return (
    <div className="mt-2 w-full space-y-2">
      <label htmlFor={`correction-${transactionId}`} className="petit block font-semibold">
        Motif de la correction
      </label>
      <Input
        id={`correction-${transactionId}`}
        value={reason}
        maxLength={200}
        onChange={(event) => setReason(event.target.value)}
        className="h-11"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => reversePointTransactionAction({ transactionId, reason }), "Ligne corrigée.")
          }
        >
          {pending ? "…" : "Annuler ces points"}
        </Button>
        <Button size="sm" variant="discret" disabled={pending} onClick={() => setOpen(false)}>
          Fermer
        </Button>
        {feedback}
      </div>
    </div>
  );
}

/** Badge décerné à la main (« Ambassadeur du savoir »), avec motif. */
export function ManualBadgeForm({
  userId,
  badges,
}: {
  userId: string;
  badges: { code: string; name: string }[];
}) {
  const [badgeCode, setBadgeCode] = useState(badges[0]?.code ?? "");
  const [reason, setReason] = useState("");
  const { pending, run, feedback } = useAdminSubmit();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    run(
      () => awardManualBadgeAction({ userId, badgeCode, reason }),
      "Badge décerné.",
      () => setReason(""),
    );
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field id="badge-choix" label="Badge">
        <Select
          id="badge-choix"
          value={badgeCode}
          onChange={(event) => setBadgeCode(event.target.value)}
        >
          {badges.map((badge) => (
            <option key={badge.code} value={badge.code}>
              {badge.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="badge-motif" label="Motif" hint="Visible du membre avec son badge.">
        <Input
          id="badge-motif"
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || !badgeCode}>
          {pending ? "…" : "Décerner le badge"}
        </Button>
        {feedback}
      </div>
    </form>
  );
}
