/*
 * Service worker minimal de L’Agora (CLAUDE.md §7 bis) :
 *  - une page hors ligne propre quand la connexion tombe pendant une navigation ;
 *  - les fichiers statiques déjà téléchargés (code, polices, logos) resservis depuis le cache.
 *  - une seule exception : la carte de membre (/member/card), gardée pour être présentée
 *    sans connexion (rangée ici lors d'un chargement complet, et par la page elle-même,
 *    keep-card-offline.tsx, lors d'une navigation côté client que ce fichier ne voit pas).
 *    Elle est effacée dès que le serveur ne la renvoie plus (session terminée,
 *    compte suspendu) et à la déconnexion (sign-out-button.tsx).
 * Aucune autre page ni donnée n'est mise en cache : ni l'administration, ni le reste de l'espace
 * membre, ni les réponses des actions.
 * Changer VERSION vide les anciens caches à l'activation.
 */
const VERSION = "v1";
const SHELL = `agora-coquille-${VERSION}`;
const ASSETS = `agora-fichiers-${VERSION}`;
/** Même nom que dans sign-out-button.tsx, qui le vide à la déconnexion. */
const CARD = "agora-carte";
const CARD_URL = "/member/card";
const OFFLINE_URL = "/offline";
const STATIC_PREFIXES = ["/_next/static/", "/logos/"];

const isStatic = (pathname) => STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

/** Adresses /_next/static/… citées dans un texte (HTML ou CSS). */
function staticUrls(text) {
  return [...new Set(text.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])];
}

/**
 * Met en cache la page hors ligne et tout ce dont elle a besoin pour s'afficher sans réseau :
 * ses feuilles de style, ses scripts et les polices que citent ses feuilles de style.
 */
async function precache() {
  const shell = await caches.open(SHELL);
  const assets = await caches.open(ASSETS);
  const response = await fetch(OFFLINE_URL, { cache: "reload" });
  if (!response.ok) throw new Error("Page hors ligne indisponible");
  await shell.put(OFFLINE_URL, response.clone());
  const urls = staticUrls(await response.text());
  await Promise.all(
    urls.map(async (url) => {
      try {
        const asset = await fetch(url);
        if (!asset.ok) return;
        await assets.put(url, asset.clone());
        if (url.endsWith(".css")) {
          const fonts = staticUrls(await asset.text());
          await Promise.all(
            fonts.map(async (font) => {
              const file = await fetch(font).catch(() => null);
              if (file?.ok) await assets.put(font, file);
            }),
          );
        }
      } catch {
        // Un fichier manquant ne doit pas empêcher l'installation.
      }
    }),
  );
  await assets.addAll(["/logos/symbole.svg", "/logos/favicon.svg"]).catch(() => undefined);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("agora-") && key !== SHELL && key !== ASSETS && key !== CARD,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation : toujours le réseau ; sans réseau, la page hors ligne.
  if (request.mode === "navigate") {
    const isCard = url.pathname === CARD_URL;
    event.respondWith(
      // `no-store` : sans lui, le navigateur ressert depuis son cache HTTP une page que le serveur
      // autorise à servir périmée (`stale-while-revalidate`), et une modification faite dans
      // l'administration n'apparaît qu'au second chargement.
      fetch(request.url, {
        cache: "no-store",
        credentials: "same-origin",
        redirect: "manual",
        headers: request.headers,
      })
        .then(async (response) => {
          if (isCard) {
            // Carte reçue : on garde la dernière. Redirection vers la connexion ou erreur : on l'efface.
            const cache = await caches.open(CARD);
            if (response.status === 200 && response.type === "basic") {
              await cache.put(CARD_URL, response.clone());
            } else {
              await cache.delete(CARD_URL);
            }
          }
          return response;
        })
        .catch(async () => {
          const card = isCard ? await caches.match(CARD_URL, { cacheName: CARD }) : undefined;
          const cached = card ?? (await caches.match(OFFLINE_URL));
          return cached ?? Response.error();
        }),
    );
    return;
  }

  // Fichiers statiques (noms uniques par version) : le cache d'abord, le réseau sinon.
  if (isStatic(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              event.waitUntil(caches.open(ASSETS).then((cache) => cache.put(request, copy)));
            }
            return response;
          }),
      ),
    );
  }
  // Tout le reste (données, actions, images téléversées) passe par le réseau, sans cache.
});
