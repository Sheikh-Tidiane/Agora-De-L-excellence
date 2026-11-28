import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { authRoutes } from "@/config/auth";
import { AssistantChat } from "@/features/assistant/components/assistant-chat";
import { isAssistantEnabled } from "@/features/assistant/enabled";
import { getAssistantStatus } from "@/features/assistant/queries";
import { formatDateTime } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Le Compagnon des Lettres" };

/**
 * Assistant du club. Non configuré (clé ou modèle absent), il n'existe pas : le proxy répond déjà
 * 404 avant le rendu ; `notFound()` reste en seconde ligne.
 */
async function Assistant() {
  const user = await requirePageAccess("member.access", `${authRoutes.member}/assistant`);
  if (!isAssistantEnabled()) notFound();
  const status = await getAssistantStatus(user.id);

  return (
    <div className="mt-6">
      <AssistantChat
        initialRemaining={status.remaining}
        dailyLimit={status.dailyLimit}
        resetsLabel={`le ${formatDateTime(status.resetsAt)}`}
      />
    </div>
  );
}

export default function AssistantPage() {
  return (
    <>
      <p className="surtitre">Le Compagnon des Lettres</p>
      <h1 className="titre-1 mt-3">Un livre, un mot, une idée&nbsp;?</h1>
      <p className="chapo mt-3 max-w-[40rem] text-gris">
        L’assistant du club conseille des lectures, explique un mot, propose un sujet de débat ou un
        quiz, et vous aide à bâtir votre critique sans l’écrire à votre place.
      </p>
      <Suspense
        fallback={
          <div aria-hidden="true" className="mt-8 space-y-4">
            <div className="skeleton h-11 w-full max-w-xl" />
            <div className="skeleton h-40 w-full max-w-xl" />
          </div>
        }
      >
        <Assistant />
      </Suspense>
    </>
  );
}
