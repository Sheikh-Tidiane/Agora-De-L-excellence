import { z } from "zod";

/**
 * Moyens de paiement d'un encaissement. Pas de paiement en ligne intégré : pour Wave et Orange
 * Money, le membre envoie la somme au numéro du club ; un responsable enregistre l'encaissement
 * avec la référence de la transaction (obligatoire, contrainte « Payment_reference_check »).
 * Sans dépendance serveur : utilisé par le formulaire et par l'action.
 */
export const paymentMethodLabels = {
  CASH: "Espèces",
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
} as const;
export type PaymentMethodCode = keyof typeof paymentMethodLabels;
export const paymentMethodCodes = Object.keys(paymentMethodLabels) as [
  PaymentMethodCode,
  ...PaymentMethodCode[],
];

/** Wave et Orange Money exigent la référence de la transaction. */
export const needsReference = (method: PaymentMethodCode) => method !== "CASH";

/** Moyen + référence, validés ensemble : référence obligatoire hors espèces, effacée en espèces. */
export const paymentMethodFields = {
  method: z.enum(paymentMethodCodes, { error: "Choisissez le moyen de paiement." }),
  reference: z
    .string({ error: "Indiquez la référence de la transaction." })
    .trim()
    .max(60, "Pas plus de 60 caractères.")
    .regex(/^[\p{L}\p{N} ._\-/#:]*$/u, "Lettres, chiffres, espaces et . _ - / # : seulement."),
};

export function checkReference(
  value: { method: PaymentMethodCode; reference: string },
  ctx: z.RefinementCtx,
) {
  if (needsReference(value.method) && value.reference.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["reference"],
      message: `Indiquez la référence de la transaction ${paymentMethodLabels[value.method]}.`,
    });
  }
}

/** Affichage court : « Wave · T_123 », « Espèces ». */
export function paymentMethodText(method: PaymentMethodCode, reference: string | null): string {
  return reference ? `${paymentMethodLabels[method]} · ${reference}` : paymentMethodLabels[method];
}
