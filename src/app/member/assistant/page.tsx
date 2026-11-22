import { Suspense } from "react";
import type { Metadata } from "next";
import { authRoutes } from "@/config/auth";
import { AssistantChat } from "@/features/assistant/components/assistant-chat";
import { getAssistantStatus } from "@/features/assistant/queries";
import { formatDateTime } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Le Compagnon des Lettres" };

/** Assistant du club. Sans clé configurée, la page le dit franchement : aucune réponse simulée. */
async function Assistant() {
  const user = await requirePageAccess("member.access", `${authRoutes.member}/assistant`);
  const status = await getAssistantStatus(user.id);

  if (!status.connected) {
    return (
      <section
        aria-labelledby="non-connecte"
        className="mt-8 max-w-[40rem] rounded-[18px] bg-sable p-6 sm:p-7"
      >
        <p className="surtitre">État</p>
        <h2 id="non-connecte" className="titre-3 mt-2">
          Assistant non connecté
        </h2>
        <p className="mt-3 text-gris">
          Le Compagnon des Lettres n’est pas encore relié à son service d’intelligence artificielle.
          Il le sera quand le club aura configuré sa clé d’accès : en attendant, aucune réponse ne
          s’affiche ici.
        </p>
      </section>
    );
  }

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
