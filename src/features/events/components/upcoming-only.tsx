"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Masque son contenu une fois la rencontre passée (début + 3 h). La fiche est prérendue et en
 * cache : l'heure ne peut être lue que dans le navigateur. Le contenu reste affiché au premier
 * rendu (rencontres à venir, le cas courant : aucun décalage).
 */
export function UpcomingOnly({ endsAt, children }: { endsAt: string; children: React.ReactNode }) {
  const past = useSyncExternalStore(
    subscribe,
    () => Date.now() > new Date(endsAt).getTime(),
    () => false,
  );
  return past ? null : children;
}
