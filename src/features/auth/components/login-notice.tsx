"use client";

import { useSearchParams } from "next/navigation";
import { FormNotice } from "@/features/auth/components/form-parts";

const notices: Record<string, string> = {
  activated: "Votre compte est activé. Connectez-vous avec votre mot de passe.",
  reset: "Mot de passe enregistré. Vous pouvez vous connecter.",
};

/** Confirmation affichée au retour d'une activation ou d'une réinitialisation. */
export function LoginNotice() {
  const notice = useSearchParams().get("notice");
  const message = notice ? notices[notice] : undefined;
  return message ? <FormNotice className="mb-6">{message}</FormNotice> : null;
}
