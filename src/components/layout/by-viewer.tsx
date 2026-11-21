import { Suspense, type ReactNode } from "react";
import { getViewer, type Viewer } from "@/features/auth/viewer";

async function Resolve({ render }: { render: (viewer: Viewer) => ReactNode }) {
  return render(await getViewer());
}

/**
 * Affiche ce qui convient au visiteur (visiteur, membre, responsable), lu côté serveur.
 *
 * Le repli tient la place du contenu le plus probable (`reserve`) mais reste **invisible** et
 * inerte : on ne montre jamais un faux état (un appel à adhérer à un membre, « Se connecter » à
 * quelqu'un de connecté), et la page ne saute pas quand le bon contenu arrive.
 */
export function ByViewer({
  render,
  reserve,
}: {
  render: (viewer: Viewer) => ReactNode;
  reserve: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div aria-hidden="true" inert className="invisible contents">
          {reserve}
        </div>
      }
    >
      <Resolve render={render} />
    </Suspense>
  );
}

/** Raccourci : contenu réservé aux visiteurs non connectés (appels à adhérer, à se connecter). */
export function ForVisitors({
  children,
  signedIn = null,
}: {
  children: ReactNode;
  /** Ce que voit à la place un membre ou un responsable (rien par défaut). */
  signedIn?: ReactNode;
}) {
  return (
    <ByViewer
      reserve={children}
      render={(viewer) => (viewer.kind === "visitor" ? children : signedIn)}
    />
  );
}
