import Image from "next/image";
import Link from "next/link";
import { HeaderAccount, MenuAccount } from "@/components/layout/header-account";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { publicNav } from "@/config/navigation";
import { site } from "@/config/site";

/**
 * En-tête du site public.
 * Mobile : symbole + « L’Agora » en texte (CLAUDE.md §7.6), action d'adhésion et menu.
 * Desktop : logo horizontal complet, rubriques, espace membre.
 * Seuls les boutons de compte dépendent du visiteur : ils sont lus côté serveur (header-account.tsx),
 * sans jamais montrer un faux état en attendant ; le reste fait partie de la coquille statique.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-trait bg-ivoire">
      <div className="page flex h-(--hauteur-entete) items-center justify-between gap-4 lg:h-[92px]">
        {/* Pas de préchargement pour les deux liens visibles dès l'ouverture sur téléphone :
            précharger l'accueil et le formulaire d'adhésion (avec son JavaScript) sur chaque page
            coûtait du temps processeur et des données aux téléphones modestes. */}
        <Link
          href="/"
          prefetch={false}
          aria-label={`${site.name}, accueil`}
          className="flex shrink-0 items-center"
        >
          <span className="flex items-center gap-2.5 lg:hidden">
            <Image src="/logos/symbole.svg" alt="" width={36} height={36} unoptimized priority />
            <span className="font-serif text-[1.375rem] leading-none">{site.shortName}</span>
          </span>
          <Image
            src="/logos/logo-horizontal.svg"
            alt=""
            width={209}
            height={76}
            unoptimized
            priority
            className="-ml-3 hidden lg:block"
          />
        </Link>

        <nav aria-label="Rubriques" className="-ml-3 hidden lg:block">
          <ul className="flex items-center gap-1 xl:gap-2">
            {publicNav.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="rounded-[6px] px-3 py-3 text-[0.9375rem] font-semibold decoration-terracotta underline-offset-[10px] transition-colors duration-200 hover:text-terracotta-fonce hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1 lg:gap-3">
          <HeaderAccount />
          <MobileMenu items={publicNav} shortName={site.shortName} actions={<MenuAccount />} />
        </div>
      </div>
    </header>
  );
}
