"use server";

import {
  cancelGuestRegistration,
  cancelMemberRegistration,
  confirmGuestRegistration,
  registerGuest,
  registerMember,
} from "@/features/events/registration";
import {
  joinWaitlistAsGuest,
  joinWaitlistAsMember,
  type JoinOutcome,
} from "@/features/events/waitlist";
import {
  eventIdSchema,
  guestRegistrationSchema,
  registrationIdSchema,
  registrationTokenSchema,
  type GuestRegistrationInput,
} from "@/features/events/schemas";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { requireUser } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";
import { clientAddress } from "@/lib/request";

/**
 * Inscriptions aux rencontres. Les actions « invité » sont publiques par nature (un visiteur
 * sans compte s'inscrit) : elles sont limitées en débit et ne s'appuient que sur le jeton
 * opaque reçu par e-mail. Les actions « membre » exigent une session.
 */

export async function registerMemberAction(input: { eventId: string }): Promise<ActionResult> {
  return runAction("events.registerMember", async () => {
    const user = await requireUser();
    const { eventId } = parseInput(eventIdSchema, input);
    await registerMember(eventId, user);
    return undefined;
  });
}

export async function cancelMemberRegistrationAction(input: {
  registrationId: string;
}): Promise<ActionResult> {
  return runAction("events.cancelMember", async () => {
    const user = await requireUser();
    const { registrationId } = parseInput(registrationIdSchema, input);
    // La propriété est vérifiée dans le service : un membre n'annule que sa propre inscription.
    await cancelMemberRegistration(registrationId, user.id);
    return undefined;
  });
}

export async function registerGuestAction(input: GuestRegistrationInput): Promise<ActionResult> {
  return runAction("events.registerGuest", async () => {
    const data = parseInput(guestRegistrationSchema, input);
    await enforceRateLimit("events.guest.ip", await clientAddress());
    await enforceRateLimit("events.guest.email", data.email);
    await registerGuest(data.eventId, { name: data.name, email: data.email });
    return undefined;
  });
}

/**
 * Un membre rejoint la liste d'attente d'une rencontre complète. S'il reste une place (libérée
 * entre-temps), il est inscrit directement.
 */
export async function joinWaitlistAction(input: {
  eventId: string;
}): Promise<ActionResult<{ outcome: "registered" } | { outcome: "waitlisted"; position: number }>> {
  return runAction("events.joinWaitlist", async () => {
    const user = await requireUser();
    const { eventId } = parseInput(eventIdSchema, input);
    await enforceRateLimit("events.waitlist.user", user.id);
    const result: JoinOutcome = await joinWaitlistAsMember(eventId, user.id);
    if (result.outcome === "register") {
      await registerMember(eventId, user);
      return { outcome: "registered" as const };
    }
    if (result.outcome === "verify") throw new Error("Résultat inattendu pour un membre.");
    return result;
  });
}

/**
 * Un visiteur demande une place sur la liste d'attente : un lien de confirmation part à son
 * adresse. S'il reste une place, il reçoit le lien d'inscription habituel.
 */
export async function joinWaitlistGuestAction(
  input: GuestRegistrationInput,
): Promise<ActionResult<{ outcome: "pending" | "verify" }>> {
  return runAction("events.joinWaitlistGuest", async () => {
    const data = parseInput(guestRegistrationSchema, input);
    await enforceRateLimit("events.guest.ip", await clientAddress());
    await enforceRateLimit("events.guest.email", data.email);
    const guest = { name: data.name, email: data.email };
    const result = await joinWaitlistAsGuest(data.eventId, guest);
    if (result.outcome === "register") {
      await registerGuest(data.eventId, guest);
      return { outcome: "pending" as const };
    }
    return { outcome: "verify" as const };
  });
}

export async function confirmGuestRegistrationAction(input: {
  token: string;
}): Promise<ActionResult> {
  return runAction("events.confirmGuest", async () => {
    const { token } = parseInput(registrationTokenSchema, input);
    await enforceRateLimit("public.token.ip", await clientAddress());
    await confirmGuestRegistration(token);
    return undefined;
  });
}

export async function cancelGuestRegistrationAction(input: {
  token: string;
}): Promise<ActionResult> {
  return runAction("events.cancelGuest", async () => {
    const { token } = parseInput(registrationTokenSchema, input);
    await enforceRateLimit("public.token.ip", await clientAddress());
    await cancelGuestRegistration(token);
    return undefined;
  });
}
