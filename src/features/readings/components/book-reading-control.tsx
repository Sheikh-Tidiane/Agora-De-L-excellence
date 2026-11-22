import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ByViewer } from "@/components/layout/by-viewer";
import { AddToReadings } from "@/features/readings/components/add-to-readings";
import { findMyReadingOfBook } from "@/features/readings/queries";
import { readingStatusLabels } from "@/features/readings/schemas";
import { getCurrentUser } from "@/lib/permissions";

async function MemberControl({ bookId }: { bookId: string }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const reading = await findMyReadingOfBook(user.id, bookId);
  if (!reading) return <AddToReadings bookId={bookId} />;
  return (
    <Link
      href={`/member/readings/${reading.id}`}
      className="inline-flex min-h-11 items-center gap-2 rounded-champ bg-sable px-4 font-semibold"
    >
      Dans mes lectures · {readingStatusLabels[reading.status]}
      <ArrowRight aria-hidden="true" className="size-4" />
    </Link>
  );
}

/**
 * Sur la fiche publique d'un livre : rien pour un visiteur ni un responsable, et pour un membre,
 * l'ajout à ses lectures (ou un lien vers sa lecture). Lu côté serveur, sans faux état en attendant.
 */
export function BookReadingControl({ bookId }: { bookId: string }) {
  return (
    <ByViewer
      reserve={null}
      render={(viewer) =>
        viewer.kind === "member" ? (
          <div className="mt-8 border-y border-indigo/20 py-5">
            <MemberControl bookId={bookId} />
          </div>
        ) : null
      }
    />
  );
}
