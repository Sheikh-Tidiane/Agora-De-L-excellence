import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/config/site";
import { getEventBySlug } from "@/features/events/queries";
import { placeLabel } from "@/features/events/rules";
import { eventDateParts, formatFullDate } from "@/lib/dates";

/**
 * Aperçu d'une rencontre partagée (WhatsApp, Facebook…) : date, titre, heure et lieu, aux couleurs
 * du club. Rien d'autre que ce qu'affiche la page publique (jamais le lien de visio). Rencontre
 * introuvable (brouillon, archive) : l'image du site, sans aucune donnée.
 */
const size = { width: 1200, height: 630 };
const SLUG = /^[a-z0-9-]{1,120}$/;

/**
 * Une seule image par rencontre, dont l'adresse change à chaque modification (`id` = date de mise
 * à jour) : WhatsApp et Facebook gardent un aperçu en cache par adresse, l'ancien (ancienne date)
 * n'est donc jamais réutilisé. Le texte alternatif reprend le titre.
 */
export async function generateImageMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = SLUG.test(slug) ? await getEventBySlug(slug) : null;
  return [
    {
      id: event ? String(event.updatedAt.getTime()) : "club",
      alt: event ? `${event.title} · ${site.name}` : site.name,
      size,
      contentType: "image/png",
    },
  ];
}

// Lus une fois au chargement du module (polices OFL, sous-ensemble latin : 50 Ko en tout).
const assets = path.join(process.cwd(), "src", "assets", "og");
const [serif, sans, logo] = await Promise.all([
  readFile(path.join(assets, "young-serif-400.woff")),
  readFile(path.join(assets, "work-sans-600.woff")),
  readFile(path.join(process.cwd(), "public", "logos", "logo-vertical-inverse.svg"), "base64"),
]);

// Couleurs du club (src/app/globals.css) : ivoire, terracotta claire (lisible sur indigo), sable.
const colors = { ivoire: "#F7F4ED", terracotta: "#E08A5F", sable: "#EDE7D9" };

export default async function EventImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Adresse invalide : l'image du site, sans requête à la base.
  const event = SLUG.test(slug) ? await getEventBySlug(slug) : null;
  const fonts = [
    { name: "Young Serif", data: serif, weight: 400 as const, style: "normal" as const },
    { name: "Work Sans", data: sans, weight: 600 as const, style: "normal" as const },
  ];

  if (!event) {
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: site.themeColor,
        }}
      >
        <img src={`data:image/svg+xml;base64,${logo}`} width={474} height={460} alt="" />
      </div>,
      { ...size, fonts },
    );
  }

  const date = eventDateParts(event.startsAt);
  const cancelled = event.status === "CANCELLED";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: site.themeColor,
        color: colors.ivoire,
        fontFamily: "Work Sans",
        padding: 64,
        gap: 56,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: 250,
          borderRight: `3px solid ${colors.terracotta}`,
          paddingRight: 48,
        }}
      >
        <div style={{ fontFamily: "Young Serif", fontSize: 150, lineHeight: 1 }}>{date.day}</div>
        <div
          style={{
            fontSize: 36,
            color: colors.terracotta,
            textTransform: "uppercase",
            letterSpacing: 4,
            marginTop: 8,
          }}
        >
          {date.month.replace(".", "")}
        </div>
        <div style={{ fontSize: 30, marginTop: 18 }}>{date.time}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        <div
          style={{
            fontSize: 26,
            color: colors.terracotta,
            textTransform: "uppercase",
            letterSpacing: 5,
          }}
        >
          {cancelled ? "Rencontre annulée" : site.name}
        </div>
        <div
          style={{
            fontFamily: "Young Serif",
            fontSize: event.title.length > 60 ? 54 : 66,
            lineHeight: 1.12,
            marginTop: 22,
            display: "flex",
            // Un mot plus long que la ligne (adresse, nom composé) passe à la ligne au lieu de déborder.
            wordBreak: "break-word",
            textDecoration: cancelled ? "line-through" : "none",
          }}
        >
          {event.title.length > 110 ? `${event.title.slice(0, 109)}…` : event.title}
        </div>
        <div style={{ fontSize: 30, marginTop: 30, color: colors.sable, display: "flex" }}>
          {formatFullDate(event.startsAt)} · {placeLabel(event.location)}
        </div>
      </div>
    </div>,
    { ...size, fonts },
  );
}
