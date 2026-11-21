"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker (page hors ligne, fichiers statiques en cache).
 * En production seulement : en développement, un cache gênerait le rechargement à chaud.
 * Ne rend rien ; l'enregistrement attend que la page soit chargée pour ne pas la ralentir.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
