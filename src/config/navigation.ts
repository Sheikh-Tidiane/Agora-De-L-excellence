export type NavItem = {
  label: string;
  href: string;
  /** Courte précision affichée dans le menu plein écran. */
  hint?: string;
};

export const publicNav: NavItem[] = [
  { label: "Le club", href: "/about", hint: "Objectifs, dimensions, comité" },
  { label: "Activités", href: "/activities", hint: "Les cinq activités du club" },
  { label: "Bibliothèque", href: "/library", hint: "Le catalogue du club" },
  { label: "Événements", href: "/events", hint: "Les prochaines rencontres" },
  { label: "Actualités", href: "/news", hint: "Comptes rendus et lectures" },
  { label: "Contact", href: "/contact", hint: "Nous écrire" },
];

export const membershipHref = "/membership";
/** Connexion à l'espace membre. */
export const loginHref = "/login";

export const footerNav: {
  title: string;
  items: NavItem[];
  /** Ajoute les liens de compte (adhérer et se connecter, ou « Mon espace ») selon le visiteur. */
  account?: boolean;
}[] = [
  {
    title: "Le club",
    items: [
      { label: "À propos", href: "/about" },
      { label: "Activités", href: "/activities" },
      { label: "Actualités", href: "/news" },
      { label: "Archives", href: "/archives" },
      { label: "Scrabble", href: "/scrabble" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Participer",
    account: true,
    items: [
      { label: "Événements", href: "/events" },
      { label: "Bibliothèque", href: "/library" },
    ],
  },
];

export const charterHref = "/charte";

export const legalNav: NavItem[] = [
  { label: "Charte du club", href: charterHref },
  { label: "Confidentialité", href: "/privacy" },
];

/**
 * Onglets de l'espace membre : barre du bas sur mobile, colonne latérale sur desktop.
 * `ready: false` = la page n'existe pas encore (phase 4, parties B et C) : l'onglet n'est pas
 * affiché, pour ne jamais mener à une page vide.
 */
export const memberTabs = [
  { label: "Accueil", key: "home", href: "/member", ready: true },
  { label: "Lectures", key: "readings", href: "/member/readings", ready: true },
  { label: "Événements", key: "events", href: "/member/events", ready: true },
  { label: "Scrabble", key: "scrabble", href: "/member/scrabble", ready: true },
  { label: "Profil", key: "profile", href: "/member/profile", ready: true },
] as const;

export type MemberTabKey = (typeof memberTabs)[number]["key"];

/** Onglet actif d'après l'adresse : le plus long préfixe gagne (« /member » n'avale pas tout). */
export function activeMemberTab(pathname: string): MemberTabKey | null {
  let best: (typeof memberTabs)[number] | null = null;
  for (const tab of memberTabs) {
    const match = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
    if (match && (!best || tab.href.length > best.href.length)) best = tab;
  }
  // La carte de membre se range sous « Profil ».
  if (best?.key === "home" && pathname.startsWith("/member/card")) return "profile";
  // Les quiz se rangent sous « Scrabble » (onglet des jeux de l'esprit).
  if (best?.key === "home" && pathname.startsWith("/member/quiz")) return "scrabble";
  return best?.key ?? null;
}

/**
 * Un toucher sur l'onglet du bas déjà actif remonte en haut de la page seulement quand on est sur
 * la page principale de l'onglet. Depuis une sous-page (fiche d'une lecture, carte de membre, quiz),
 * il ramène à la page principale, comme dans les applis.
 */
export function tabTapScrollsToTop(pathname: string, tabHref: string): boolean {
  return pathname.replace(/\/+$/, "") === tabHref;
}
