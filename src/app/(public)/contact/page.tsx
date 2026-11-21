import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/layout/page-intro";
import { membershipHref } from "@/config/navigation";
import { site } from "@/config/site";
import { ContactForm } from "@/features/contact/components/contact-form";
import { contactRecipient, getClubSettings, socialLinks } from "@/features/settings/club";
import { formatPhone } from "@/lib/phone";
import { ForVisitors } from "@/components/layout/by-viewer";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Écrire au club : une question sur une rencontre, une proposition de partenariat, une invitation.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const club = await getClubSettings();
  const socials = socialLinks(club);
  const canWrite = contactRecipient(club) !== null;
  // Seules les coordonnées réellement saisies par le club s'affichent : aucune adresse inventée.
  const coordinates = [
    club.email ? { label: "E-mail", value: club.email, href: `mailto:${club.email}` } : null,
    club.phone
      ? {
          label: "Téléphone",
          value: formatPhone(club.phone.replace(/\s/g, "")) || club.phone,
          href: `tel:${club.phone.replace(/\s/g, "")}`,
        }
      : null,
    club.address ? { label: "Où nous trouver", value: club.address, href: null } : null,
  ].filter((item) => item !== null);

  return (
    <>
      <PageIntro surtitre="Contact" letter="C" arc="b" title="Écrivez-nous.">
        Une question sur une rencontre, une idée de partenariat, une invitation&nbsp;: le club lit
        tous les messages et répond par e-mail.
      </PageIntro>

      <div className="page py-12 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-24">
        <div className="lg:col-span-6">
          <h2 className="titre-3">Votre message</h2>
          <div className="mt-6">
            {canWrite ? (
              <ContactForm />
            ) : (
              <p className="rounded-champ bg-sable px-5 py-4">
                Le formulaire de contact sera ouvert dès que le club aura enregistré son adresse.
              </p>
            )}
          </div>
        </div>

        <aside className="mt-14 lg:col-span-4 lg:col-start-9 lg:mt-0">
          <h2 className="surtitre">{club.name}</h2>
          <p className="mt-3 font-serif text-[1.375rem] leading-snug">
            {site.baseline} à {site.city}.
          </p>

          {coordinates.length > 0 ? (
            <dl className="mt-6 border-t border-indigo/20">
              {coordinates.map((item) => (
                <div key={item.label} className="border-b border-indigo/20 py-4">
                  <dt className="petit text-gris">{item.label}</dt>
                  <dd className="mt-0.5 font-semibold break-words">
                    {item.href ? (
                      <a href={item.href} className="lien inline-block py-1">
                        {item.value}
                      </a>
                    ) : (
                      item.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {socials.length > 0 ? (
            <>
              <h3 className="surtitre mt-8">Nous suivre</h3>
              <ul className="mt-2 -ml-2 flex flex-wrap">
                {socials.map((social) => (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      rel="noopener noreferrer"
                      className="lien inline-flex min-h-11 items-center px-2"
                    >
                      {social.label}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <ForVisitors>
            <div className="mt-8 border-l-2 border-indigo pl-5">
              <p className="font-semibold">Vous voulez rejoindre le club&nbsp;?</p>
              <p className="mt-1 text-gris">
                Inutile de nous écrire&nbsp;: la demande d’adhésion se fait en deux minutes.
              </p>
              <Link href={membershipHref} className="lien mt-1 inline-flex min-h-11 items-center">
                Demander mon adhésion
              </Link>
            </div>
          </ForVisitors>
        </aside>
      </div>
    </>
  );
}
