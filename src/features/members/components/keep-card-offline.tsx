"use client";

import { useEffect } from "react";
import { CARD_CACHE, CARD_URL } from "@/features/members/offline-card";

/**
 * Range la carte affichée dans le cache du service worker, pour la présenter sans connexion.
 * Nécessaire parce que le service worker ne voit que les chargements complets : ouverte depuis un
 * lien de l'espace membre (navigation côté client), la carte n'y entrerait jamais.
 * Seule une vraie page de carte (200, même origine, sans redirection) remplace la précédente.
 * Sans service worker (développement, navigateur ancien), ne fait rien.
 */
export function KeepCardOffline() {
  useEffect(() => {
    if (!("caches" in window) || !navigator.serviceWorker?.controller) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(CARD_URL, {
          credentials: "same-origin",
          cache: "no-store",
          redirect: "manual",
          signal: controller.signal,
        });
        if (response.status !== 200 || response.type !== "basic") return;
        await (await caches.open(CARD_CACHE)).put(CARD_URL, response);
      } catch {
        // Hors ligne ou page quittée : la carte déjà gardée reste en place.
      }
    })();
    return () => controller.abort();
  }, []);
  return null;
}
