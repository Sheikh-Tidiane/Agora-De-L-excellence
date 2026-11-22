"use server";

import { z } from "zod";
import { cancelPayment, recordAttendance, recordCardPayment } from "@/features/payments/service";
import { parseLocalDateTime } from "@/lib/dates";
import { AppError, parseInput, runAction, type ActionResult } from "@/lib/errors";
import { can, requirePermission, requireUser } from "@/lib/permissions";

/** Encaissements : chaque action vérifie sa permission ; le service trace l'opération. */
const id = z.string().min(1).max(40);

const cardSchema = z.object({
  userId: id,
  /** Date d'encaissement (`AAAA-MM-JJ`). */
  paidAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Indiquez la date d’encaissement.")
    .transform((value) => parseLocalDateTime(`${value}T00:00`))
    .refine((value): value is Date => value !== null, "Indiquez la date d’encaissement."),
  note: z.string().trim().max(200, "Pas plus de 200 caractères."),
});

export async function recordCardPaymentAction(input: {
  userId: string;
  paidAt: string;
  note: string;
}): Promise<ActionResult<{ amount: number }>> {
  return runAction("payments.card", async () => {
    const actor = await requirePermission("payments.record");
    const payment = await recordCardPayment(parseInput(cardSchema, input), actor.id);
    return { amount: payment.amount };
  });
}

const cancelSchema = z.object({
  paymentId: id,
  reason: z.string().trim().min(3, "Indiquez le motif de l’annulation.").max(200),
});

export async function cancelPaymentAction(input: {
  paymentId: string;
  reason: string;
}): Promise<ActionResult> {
  return runAction("payments.cancel", async () => {
    const actor = await requirePermission("payments.record");
    const { paymentId, reason } = parseInput(cancelSchema, input);
    await cancelPayment(paymentId, reason, actor.id);
    return undefined;
  });
}

const attendanceSchema = z.object({ registrationId: id, present: z.boolean(), paid: z.boolean() });

/** Pointage d'un inscrit : présence (`attendance.record`) et participation (`payments.record`). */
export async function recordAttendanceAction(input: {
  registrationId: string;
  present: boolean;
  paid: boolean;
}): Promise<ActionResult> {
  return runAction("payments.attendance", async () => {
    const actor = await requireUser();
    const rights = {
      attendance: can(actor, "attendance.record"),
      payments: can(actor, "payments.record"),
    };
    if (!rights.attendance && !rights.payments) throw new AppError("FORBIDDEN");
    await recordAttendance(parseInput(attendanceSchema, input), actor.id, rights);
    return undefined;
  });
}
