import { CalendarPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { calendarLinks } from "@/features/events/calendar";
import { ShareButtons } from "@/features/events/components/share-buttons";
import { UpcomingOnly } from "@/features/events/components/upcoming-only";
import type { PublicEvent } from "@/features/events/queries";
import { shareData, whatsappMessage, whatsappUrl } from "@/features/events/share";
import { cn } from "@/lib/utils";

/**
 * « Ajouter à mon agenda » (fichier .ics, Google Agenda) et partage de la rencontre. Statique :
 * prérendu avec la fiche (aucune lecture de l'heure ni de la session). Rien pour une rencontre
 * annulée ; masqué dans le navigateur une fois la rencontre passée.
 */
export function EventActions({ event, appUrl }: { event: PublicEvent; appUrl: string }) {
  if (event.status === "CANCELLED") return null;
  const { google } = calendarLinks(event, appUrl);
  const over = new Date(event.startsAt.getTime() + 3 * 3_600_000).toISOString();
  return (
    <UpcomingOnly endsAt={over}>
      <section aria-labelledby="partager-titre" className="rounded-feuille bg-blanc p-5 sm:p-7">
        <h2 id="partager-titre" className="titre-3">
          Agenda et partage
        </h2>
        <p className="surtitre mt-4">Ajouter à mon agenda</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            // Chemin relatif sur la page : même origine que le site (l'adresse absolue sert aux e-mails).
            href={`/events/${event.slug}/agenda.ics`}
            download={`${event.slug}.ics`}
            className={cn(buttonVariants({ variant: "contour" }), "max-sm:flex-1")}
          >
            <CalendarPlus aria-hidden="true" />
            Fichier agenda (.ics)
          </a>
          <a
            href={google}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "contour" }), "max-sm:flex-1")}
          >
            Google Agenda
            <span className="sr-only"> (nouvel onglet)</span>
          </a>
        </div>
        <p className="petit mt-2 text-gris">
          Le fichier .ics s’ouvre dans l’agenda du téléphone (iPhone, Android) ou d’Outlook.
        </p>
        <p className="surtitre mt-5">Inviter quelqu’un</p>
        <div className="mt-2">
          <ShareButtons
            whatsappHref={whatsappUrl(whatsappMessage(event, appUrl))}
            share={shareData(event, appUrl)}
          />
        </div>
      </section>
    </UpcomingOnly>
  );
}
