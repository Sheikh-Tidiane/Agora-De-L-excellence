import type { Metadata } from "next";
import Link from "next/link";
import { rules } from "@/config/rules";
import { getClubSettings } from "@/features/settings/club";

export const metadata: Metadata = {
  title: "Confidentialité",
  description:
    "Quelles données le club recueille, pourquoi, combien de temps, et comment les faire corriger ou supprimer.",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const club = await getClubSettings();
  const retention = rules["membership.rejectedRetentionMonths"];
  const contactRetention = rules["contact.handledRetentionMonths"];

  const sections: { id: string; title: string; body: React.ReactNode }[] = [
    {
      id: "principe",
      title: "Le principe",
      body: (
        <p>
          {club.name} ne recueille que ce dont il a besoin pour faire vivre le club&nbsp;: traiter
          les adhésions, organiser les rencontres, répondre aux messages. Rien n’est vendu, rien
          n’est transmis à des annonceurs, et le site ne contient aucun traceur publicitaire.
        </p>
      ),
    },
    {
      id: "donnees",
      title: "Ce que nous recueillons",
      body: (
        <ul>
          <li>
            <strong>Demande d’adhésion</strong>&nbsp;: prénom, nom, adresse e-mail, téléphone
            (facultatif), tranche d’âge, situation, centres d’intérêt, et le mot que vous choisissez
            d’ajouter. Pour un mineur, le nom et le téléphone d’un parent ou tuteur.
          </li>
          <li>
            <strong>Inscription à une rencontre</strong>&nbsp;: pour un visiteur, un nom et une
            adresse e-mail&nbsp;; pour un membre, son compte suffit.
          </li>
          <li>
            <strong>Formulaire de contact</strong>&nbsp;: votre nom, votre adresse e-mail et votre
            message, transmis par e-mail au club et conservés dans son espace d’administration,
            consultable seulement par les responsables chargés d’y répondre.
          </li>
          <li>
            <strong>Compte membre</strong>&nbsp;: les informations de l’adhésion, un mot de passe
            (conservé sous forme hachée, illisible même pour nous) et l’historique de vos
            inscriptions.
          </li>
        </ul>
      ),
    },
    {
      id: "usage",
      title: "À quoi cela sert",
      body: (
        <p>
          À vous répondre, à tenir la liste des membres, à connaître le nombre de participants à une
          rencontre et à vous envoyer les messages liés à vos démarches&nbsp;: accusé de réception,
          lien d’activation, confirmation d’inscription. Le club n’envoie pas de publicité.
        </p>
      ),
    },
    {
      id: "duree",
      title: "Combien de temps",
      body: (
        <ul>
          <li>Une demande d’adhésion refusée est supprimée au bout de {retention} mois.</li>
          <li>
            Un message envoyé par le formulaire de contact est supprimé {contactRetention} mois
            après que le club l’a traité.
          </li>
          <li>
            Les données d’un membre sont conservées pendant son adhésion. Un membre qui quitte le
            club peut demander que son compte soit anonymisé.
          </li>
          <li>
            Une inscription de visiteur non confirmée cesse de compter après vingt-quatre heures.
          </li>
        </ul>
      ),
    },
    {
      id: "acces",
      title: "Qui y a accès",
      body: (
        <p>
          Les responsables du club, chacun selon son rôle et pas davantage&nbsp;: un responsable de
          la bibliothèque ne voit pas les demandes d’adhésion, par exemple. Les actions sensibles
          (validation d’une adhésion, changement de rôle, suspension) sont consignées dans un
          journal.
        </p>
      ),
    },
    {
      id: "cookies",
      title: "Cookies",
      body: (
        <p>
          Un seul cookie est déposé, et seulement quand vous vous connectez&nbsp;: il maintient
          votre session ouverte. Il n’y a ni mesure d’audience tierce ni cookie publicitaire, donc
          pas de bandeau à accepter.
        </p>
      ),
    },
    {
      id: "droits",
      title: "Vos droits",
      body: (
        <>
          <p>
            Conformément à la loi sénégalaise n°&nbsp;2008-12 sur la protection des données à
            caractère personnel, vous pouvez demander à consulter, faire corriger ou faire supprimer
            les informations qui vous concernent, et vous opposer à leur traitement.
          </p>
          <p>
            Il suffit d’écrire au club depuis la{" "}
            <Link href="/contact" className="lien">
              page Contact
            </Link>
            {club.email ? (
              <>
                {" "}
                ou à l’adresse{" "}
                <a href={`mailto:${club.email}`} className="lien">
                  {club.email}
                </a>
              </>
            ) : null}
            . Vous pouvez aussi saisir la Commission de protection des données personnelles (CDP).
          </p>
        </>
      ),
    },
  ];

  return (
    <div className="page py-10 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-24">
      <div className="lg:col-span-4">
        <div className="lg:sticky lg:top-32">
          <p className="surtitre">Confidentialité</p>
          <h1 className="titre-1 mt-3">Vos données, en clair.</h1>
          <p className="chapo mt-5 text-gris">
            Une page courte, sans jargon&nbsp;: ce que le club sait de vous et ce qu’il en fait.
          </p>
          <nav aria-label="Sommaire" className="mt-8 hidden lg:block">
            <ol>
              {sections.map((section, i) => (
                <li key={section.id} className="border-t border-indigo/20">
                  <a
                    href={`#${section.id}`}
                    className="flex min-h-11 items-center gap-3 text-[0.9375rem] font-semibold hover:text-terracotta-fonce"
                  >
                    <span className="font-serif text-terracotta-fonce">{i + 1}</span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>

      <div className="mt-10 lg:col-span-7 lg:col-start-6 lg:mt-0">
        {sections.map((section, i) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-titre`}
            className="scroll-mt-28 border-t border-indigo/20 py-8 first:border-t-2 first:border-indigo"
          >
            <h2 id={`${section.id}-titre`} className="titre-3 flex gap-3">
              <span className="text-terracotta-fonce">{i + 1}</span>
              {section.title}
            </h2>
            <div className="prose-agora mt-4 max-w-(--container-lecture)">{section.body}</div>
          </section>
        ))}
        <p className="petit border-t border-indigo/20 pt-6 text-gris">
          Cette page décrit le fonctionnement actuel du site. Elle sera mise à jour si celui-ci
          évolue.
        </p>
      </div>
    </div>
  );
}
