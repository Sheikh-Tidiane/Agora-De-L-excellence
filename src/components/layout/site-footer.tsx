import Image from "next/image";
import Link from "next/link";
import { Hemicycle, gradins } from "@/components/shared/hemicycle";
import { footerNav, legalNav, loginHref, membershipHref } from "@/config/navigation";
import { site } from "@/config/site";
import { getClubSettings, socialLinks } from "@/features/settings/club";
import { ByViewer } from "@/components/layout/by-viewer";
import { spaceHref, type Viewer } from "@/features/auth/viewer";

const rangs = gradins(
  ["rgb(247 244 237 / 0.10)", "rgb(247 244 237 / 0.07)", "rgb(247 244 237 / 0.05)"],
  { inner: 70, step: 16 },
);

const footerLink =
  "inline-flex min-h-11 items-center px-2 transition-colors duration-200 hover:text-terracotta-clair";

/** « Adhérer » et « Se connecter » pour un visiteur ; « Mon espace » pour un membre. */
function FooterAccountLinks({ viewer }: { viewer: Viewer }) {
  if (viewer.kind !== "visitor") {
    return (
      <li>
        <Link href={spaceHref(viewer)} className={footerLink}>
          Mon espace
        </Link>
      </li>
    );
  }
  return (
    <>
      <li>
        <Link href={membershipHref} className={footerLink}>
          Adhérer
        </Link>
      </li>
      <li>
        <Link href={loginHref} className={footerLink}>
          Se connecter
        </Link>
      </li>
    </>
  );
}

export async function SiteFooter() {
  const club = await getClubSettings();
  const socials = socialLinks(club);
  return (
    <footer className="sur-indigo relative overflow-hidden bg-indigo text-ivoire">
      {/* Gradins en filigrane, rognés par le coin : le motif, pas le logo. */}
      <div className="pointer-events-none absolute -right-40 -bottom-56 w-[560px] lg:-right-24 lg:w-[760px]">
        <Hemicycle rows={rangs} overshoot={0} />
      </div>

      <div className="page relative grid gap-12 pt-16 pb-10 lg:grid-cols-12 lg:gap-8 lg:pt-24">
        <div className="lg:col-span-6">
          <Image
            src="/logos/logo-horizontal-inverse.svg"
            alt={club.name}
            width={220}
            height={80}
            unoptimized
            className="-ml-3"
          />
          {club.slogan ? (
            <p className="mt-6 max-w-[22rem] font-serif text-[1.375rem] leading-snug text-balance">
              {club.slogan}
            </p>
          ) : null}
          <p className="mt-3 text-ivoire/80">
            {site.baseline} · {site.city}, Sénégal
          </p>
          {socials.length > 0 ? (
            <ul aria-label="Réseaux sociaux" className="mt-4 -ml-2 flex flex-wrap">
              {socials.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center px-2 font-semibold transition-colors duration-200 hover:text-terracotta-clair"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {footerNav.map((group) => (
          <nav key={group.title} aria-label={group.title} className="lg:col-span-3">
            <h2 className="surtitre">{group.title}</h2>
            <ul className="mt-4 -ml-2">
              {group.items.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className={footerLink}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            {/* Liste à part : le repli de <ByViewer> est un <div>, interdit dans un <ul>. */}
            {group.account ? (
              <ByViewer
                reserve={
                  <ul className="-ml-2">
                    <FooterAccountLinks viewer={{ kind: "visitor" }} />
                  </ul>
                }
                render={(viewer) => (
                  <ul className="-ml-2">
                    <FooterAccountLinks viewer={viewer} />
                  </ul>
                )}
              />
            ) : null}
          </nav>
        ))}

        <div className="flex flex-col gap-2 border-t border-ivoire/15 pt-6 text-sm text-ivoire/70 sm:flex-row sm:items-center sm:justify-between lg:col-span-12">
          <p>
            © {site.since} {club.name} · {site.city}, Sénégal
          </p>
          <ul className="-ml-2 flex">
            {legalNav.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center px-2 underline underline-offset-4 hover:text-ivoire"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
