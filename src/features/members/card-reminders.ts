import {
  acceptedAt,
  cardDeadline,
  remindersDue,
  type ReminderKind,
} from "@/features/members/card-dues";
import { createNotifications, sendNotificationEmails } from "@/features/notifications/service";
import { loadClubSettings } from "@/features/settings/club";
import type { ClubSettings } from "@/features/settings/schemas";
import { formatDate } from "@/lib/dates";
import { logger } from "@/lib/logger";
import { formatFcfa } from "@/lib/money";
import { prisma } from "@/lib/prisma";

/**
 * Rappels « carte à régler » (docs/REGLES-METIER.md, « Cotisations ») : une notification et un
 * e-mail au membre, 7 jours après l'acceptation de son adhésion, puis 3 jours avant la fin du délai
 * de grâce, tant que la carte n'est pas réglée. Lancé chaque jour (scripts/rappels-carte.ts,
 * minuterie deploy/systemd/agora-rappels-carte.*).
 *
 * Sans doublon : le rappel est réservé dans `CardReminder` (unique par membre et par sorte) dans la
 * même transaction que la notification. Deux passages simultanés ne peuvent pas envoyer deux fois :
 * le second ne réserve rien. L'e-mail part après ; s'il échoue, il est journalisé, pas renvoyé.
 */
export type ReminderRun = { checked: number; sent: { userId: string; kind: ReminderKind }[] };

export async function sendCardReminders(now: Date = new Date()): Promise<ReminderRun> {
  const settings = await loadClubSettings();
  const members = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      archivedAt: null,
      memberNumber: { not: null },
      memberships: { some: {} },
      payments: { none: { kind: "MEMBERSHIP_CARD", cancelledAt: null } },
    },
    select: {
      id: true,
      memberNumber: true,
      memberships: { select: { startsAt: true } },
      cardReminders: { select: { kind: true } },
    },
  });
  const run: ReminderRun = { checked: members.length, sent: [] };
  for (const member of members) {
    const kinds = remindersDue(
      { paid: false, memberships: member.memberships },
      member.cardReminders.map((r) => r.kind),
      settings.cardGraceDays,
      now,
    );
    for (const kind of kinds) {
      const ids = await prisma.$transaction(async (tx) => {
        const { count } = await tx.cardReminder.createMany({
          data: [{ userId: member.id, kind, sentAt: now }],
          skipDuplicates: true,
        });
        if (count === 0) return [];
        return createNotifications([reminderNotification(member, kind, settings)], tx);
      });
      if (ids.length === 0) continue;
      await sendNotificationEmails(ids);
      run.sent.push({ userId: member.id, kind });
    }
  }
  logger.info("Rappels de carte envoyés", { checked: run.checked, sent: run.sent.length });
  return run;
}

/** Texte du rappel : montant, numéros du club, référence (numéro de membre), date limite. */
export function reminderNotification(
  member: { id: string; memberNumber: string | null; memberships: { startsAt: Date }[] },
  kind: ReminderKind,
  settings: Pick<
    ClubSettings,
    "membershipCardFee" | "waveNumber" | "orangeMoneyNumber" | "cardGraceDays"
  >,
) {
  const accepted = acceptedAt(member.memberships)!;
  const deadline = formatDate(cardDeadline(accepted, settings.cardGraceDays));
  const ways = [
    settings.waveNumber ? `par Wave au ${settings.waveNumber}` : null,
    settings.orangeMoneyNumber ? `par Orange Money au ${settings.orangeMoneyNumber}` : null,
    "en espèces auprès d’un responsable lors d’une rencontre",
  ].filter(Boolean);
  const reference =
    (settings.waveNumber || settings.orangeMoneyNumber) && member.memberNumber
      ? ` Pour Wave ou Orange Money, indiquez en motif votre numéro de membre : ${member.memberNumber}.`
      : "";
  const intro =
    kind === "BEFORE_DEADLINE"
      ? `Plus que 3 jours pour régler votre carte de membre (${formatFcfa(settings.membershipCardFee)}) : avant le ${deadline}.`
      : `Votre carte de membre (${formatFcfa(settings.membershipCardFee)}) reste à régler, avant le ${deadline}.`;
  return {
    userId: member.id,
    type: "card.reminder" as const,
    title:
      kind === "BEFORE_DEADLINE"
        ? "Votre carte de membre : plus que 3 jours"
        : "Votre carte de membre reste à régler",
    body: `${intro} Vous pouvez la régler ${ways.join(", ")}.${reference}`,
    href: "/member/card",
  };
}
