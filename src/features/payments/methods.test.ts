import { describe, expect, it } from "vitest";
import { missingReference, paymentMethodText } from "@/features/payments/methods";

describe("moyens de paiement", () => {
  it("référence exigée pour Wave et Orange Money, jamais pour les espèces", () => {
    expect(missingReference("CASH", "")).toBeUndefined();
    expect(missingReference("WAVE", "  ")).toBe("Indiquez la référence de la transaction Wave.");
    expect(missingReference("ORANGE_MONEY", "")).toBe(
      "Indiquez la référence de la transaction Orange Money.",
    );
    expect(missingReference("WAVE", "T_7Q2KX9")).toBeUndefined();
  });

  it("affichage court du moyen et de la référence", () => {
    expect(paymentMethodText("WAVE", "T_1")).toBe("Wave · T_1");
    expect(paymentMethodText("CASH", null)).toBe("Espèces");
  });
});
