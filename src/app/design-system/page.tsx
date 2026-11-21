import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { MemberTabBar } from "@/components/layout/member-tab-bar";
import { BookCard } from "@/components/shared/book-card";
import { BottomSheet } from "@/components/shared/bottom-sheet";
import { EventRow, Tag } from "@/components/shared/event-row";
import { GeneratedCover } from "@/components/shared/generated-cover";
import { Hemicycle, gradins } from "@/components/shared/hemicycle";
import { LetterTile, TileWord } from "@/components/shared/letter-tile";
import {
  BookCardSkeleton,
  EmptyState,
  ErrorState,
  EventRowSkeleton,
  TileLoader,
} from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { site } from "@/config/site";
import { eventTypeLabels } from "@/config/activities";
import { eventDateParts } from "@/lib/dates";
import { books, events } from "../../../prisma/demo-data";
import { Block, Swatch } from "./parts";

export const metadata: Metadata = { title: "Design system", robots: { index: false } };

const couleurs = [
  { name: "indigo", value: "#1F2A55", className: "bg-indigo", note: "12,6:1 sur ivoire" },
  {
    name: "terracotta",
    value: "#C2562E",
    className: "bg-terracotta",
    note: "Graphique et gros titres",
  },
  {
    name: "terracotta-fonce",
    value: "#A9471F",
    className: "bg-terracotta-fonce",
    note: "5,3:1 · petit texte",
  },
  {
    name: "terracotta-clair",
    value: "#E08A5F",
    className: "bg-terracotta-clair",
    note: "5,2:1 sur indigo",
  },
  {
    name: "ivoire",
    value: "#F7F4ED",
    className: "bg-ivoire border border-trait",
    note: "Fond de page",
  },
  { name: "sable", value: "#EDE7D9", className: "bg-sable", note: "Section alternée" },
  {
    name: "blanc",
    value: "#FFFFFF",
    className: "bg-blanc border border-trait",
    note: "Cartes, champs",
  },
  { name: "gris", value: "#5E6478", className: "bg-gris", note: "5,4:1 · texte secondaire" },
  { name: "succes", value: "#2F6B4F", className: "bg-succes", note: "5,7:1 sur ivoire" },
  { name: "alerte", value: "#85540F", className: "bg-alerte", note: "5,8:1 sur ivoire" },
  { name: "erreur", value: "#9B1C31", className: "bg-erreur", note: "7,3:1 sur ivoire" },
];

const gabarits = ["cadre", "bandeau", "initiale", "gradins", "lignes"] as const;

export default function DesignSystemPage() {
  // Outil interne : n'existe pas en production.
  if (process.env.NODE_ENV === "production") notFound();

  const event = events[0];

  return (
    <main className="page py-12 lg:py-20">
      <p className="surtitre">Outil interne · développement</p>
      <h1 className="titre-1 mt-3">Design system</h1>
      <p className="chapo mt-4 text-gris">
        Les briques de l’identité de {site.name}. Référence : docs/DIRECTION-ARTISTIQUE.md.
      </p>

      <Block title="Couleurs">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {couleurs.map((c) => (
            <Swatch key={c.name} {...c} />
          ))}
        </ul>
      </Block>

      <Block title="Typographie">
        <div className="space-y-6">
          <p className="titre-affiche">Ici, les mots</p>
          <p className="titre-1">Titre 1 — Un mois à l’Agora</p>
          <p className="titre-2">Titre 2 — Sur l’étagère du club</p>
          <p className="titre-3">Titre 3 — Tournoi amical de Scrabble</p>
          <p className="surtitre">Surtitre · le livre du mois</p>
          <p className="chapo">
            Chapô. Ramatoulaye écrit à son amie Aïssatou pendant son deuil : un roman court, une
            langue limpide.
          </p>
          <p className="max-w-lecture">
            Texte courant, Work Sans 400, entre 60 et 75 caractères par ligne. Le club n’est ni une
            salle de classe ni un simple loisir : on y vient pour le plaisir, on en repart avec un
            vocabulaire plus riche.{" "}
            <a href="#boutons" className="lien">
              Un lien dans le texte
            </a>
            .
          </p>
          <p className="petit text-gris">Petit texte secondaire : samedi, 16 h · Dakar.</p>
        </div>
      </Block>

      <Block title="Boutons" id="boutons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="action">
            Rejoindre le club <ArrowRight aria-hidden="true" />
          </Button>
          <Button>Principal</Button>
          <Button variant="contour">Contour</Button>
          <Button variant="discret">Discret</Button>
          <Button disabled>Désactivé</Button>
          <Button size="sm">Petit (44 px)</Button>
          <Button size="lg" variant="action">
            Grand (56 px)
          </Button>
        </div>
        <div className="sur-indigo mt-6 flex flex-wrap items-center gap-3 rounded-feuille bg-indigo p-5">
          <Button variant="clair">Sur indigo</Button>
          <Button variant="contour-clair">Contour clair</Button>
        </div>
      </Block>

      <Block title="Champs">
        <div className="grid max-w-3xl gap-5 md:grid-cols-2">
          <Field id="ds-prenom" label="Prénom">
            <Input id="ds-prenom" autoComplete="given-name" placeholder="Awa" />
          </Field>
          <Field
            id="ds-tel"
            label="Téléphone"
            hint="Format sénégalais, ex. +221 77 123 45 67"
            optional
          >
            <Input
              id="ds-tel"
              type="tel"
              autoComplete="tel"
              defaultValue="+221 "
              aria-describedby="ds-tel-aide"
            />
          </Field>
          <Field id="ds-email" label="Adresse e-mail" error="Cette adresse n’est pas valide.">
            <Input
              id="ds-email"
              type="email"
              autoComplete="email"
              defaultValue="awa@exemple"
              aria-invalid
              aria-describedby="ds-email-erreur"
            />
          </Field>
          <Field id="ds-statut" label="Vous êtes">
            <Select id="ds-statut" defaultValue="etudiant">
              <option value="eleve">Élève</option>
              <option value="etudiant">Étudiant·e</option>
              <option value="actif">En activité</option>
            </Select>
          </Field>
          <Field
            id="ds-motivation"
            label="Pourquoi nous rejoindre ?"
            optional
            className="md:col-span-2"
          >
            <Textarea id="ds-motivation" />
          </Field>
        </div>
      </Block>

      <Block title="Étiquettes">
        <div className="flex flex-wrap gap-2">
          <Tag tone="accent">Lecture</Tag>
          <Tag>Ouvert au public</Tag>
          <Tag tone="succes">Adhésion validée</Tag>
          <Tag tone="alerte">En attente</Tag>
          <Tag tone="erreur">Complet</Tag>
        </div>
      </Block>

      <Block title="Tuile de lettre">
        <div className="flex flex-wrap items-end gap-4">
          <LetterTile letter="A" className="text-[96px]" />
          <LetterTile letter="J" tone="indigo" className="text-[72px]" />
          <LetterTile letter="D" tone="terracotta" className="text-[56px]" />
          <LetterTile letter="L" tone="clair" />
          <LetterTile letter="W" tone="sable" className="text-[40px]" />
          <LetterTile
            letter="1"
            value={null}
            tone="indigo"
            className="text-[40px]"
            label="Premier"
          />
        </div>
        <div className="mt-6">
          <TileWord word="AGORA" tileClassName="text-[56px]" />
        </div>
        <div className="mt-6 flex items-center gap-4">
          <TileLoader />
          <span className="petit text-gris">Indicateur d’attente</span>
        </div>
      </Block>

      <Block title="Hémicycle">
        <div className="max-w-xl">
          <Hemicycle
            rows={gradins([
              "var(--color-terracotta-clair)",
              "var(--color-terracotta)",
              "var(--color-indigo)",
              "var(--color-trait)",
            ])}
          />
        </div>
      </Block>

      <Block title="Couvertures générées">
        <p className="petit mb-5 text-gris">Les cinq gabarits, puis les livres de démonstration.</p>
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {gabarits.map((g, i) => (
            <li key={g}>
              <GeneratedCover
                title="Une si longue lettre"
                author="Mariama Bâ"
                variant={g}
                palette={i}
              />
              <p className="petit mt-2 font-semibold">{g}</p>
            </li>
          ))}
        </ul>
        <ul className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-8">
          {books.map((b) => (
            <li key={b.slug}>
              <GeneratedCover title={b.title} author={b.author} category={b.category} />
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Carte livre">
        <div className="grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-3">
          <BookCard href="#" {...books[1]} />
          <BookCard href="#" {...books[4]} />
          <BookCardSkeleton />
        </div>
      </Block>

      <Block title="Ligne d’agenda">
        <div className="max-w-3xl border-b border-indigo/20">
          <EventRow
            href="#"
            title={event.title}
            {...eventDateParts(new Date(`${event.iso}:00Z`))}
            type={eventTypeLabels[event.type]}
            place="Lieu à confirmer"
            open={event.open}
            summary={event.summary}
          />
          <EventRowSkeleton />
        </div>
      </Block>

      <Block title="États">
        <div className="grid gap-8 lg:grid-cols-2">
          <EmptyState
            title="Aucune rencontre annoncée"
            action={<Button variant="contour">Voir les rencontres passées</Button>}
          >
            Le programme du mois prochain arrive bientôt. Les membres sont prévenus en premier.
          </EmptyState>
          <ErrorState action={<Button size="sm">Réessayer</Button>}>
            Impossible de charger l’agenda. Vérifiez votre connexion.
          </ErrorState>
        </div>
      </Block>

      <Block title="Bottom sheet">
        <BottomSheet title="S’inscrire à la rencontre" trigger="Ouvrir la feuille">
          <p className="text-gris">
            Sur mobile, les confirmations et formulaires courts montent du bas de l’écran, dans la
            zone du pouce.
          </p>
          <Button variant="action" largeur="pleine" className="mt-5">
            Confirmer mon inscription
          </Button>
        </BottomSheet>
      </Block>

      <Block title="Barre d’onglets de l’espace membre">
        <div className="max-w-md overflow-hidden rounded-feuille border border-trait">
          <div className="petit grid h-28 place-items-center bg-ivoire text-gris">
            Contenu de la page
          </div>
          <MemberTabBar active="readings" />
        </div>
      </Block>
    </main>
  );
}
