import { describe, expect, it } from "vitest";
import {
  shareData,
  shareText,
  whatsappMessage,
  whatsappUrl,
  type ShareSource,
} from "@/features/events/share";
import { registrationConfirmedEmail } from "@/lib/mail/club-templates";

const APP = "https://agora.test";
const event: ShareSource = {
  slug: "rendez-vous-lecture",
  title: "Rendez-vous lecture : « L’Aventure ambiguë » & débat #3 ?",
  startsAt: new Date("2026-12-05T18:00:00Z"),
  location: "Maison de la culture Douta Seck",
  isTentative: false,
};
const decode = (href: string) => decodeURIComponent(href.replace("https://wa.me/?text=", ""));

describe("partage d'une rencontre", () => {
  it("message WhatsApp : titre, date à l'heure de Dakar, lieu, adresse en dernier", () => {
    const message = whatsappMessage(event, APP);
    const lines = message.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(event.title);
    expect(lines[1]!.replace(/\s/g, " ")).toBe(
      "samedi 5 décembre 2026 à 18 h · Maison de la culture Douta Seck",
    );
    expect(lines[2]).toBe("https://agora.test/events/rendez-vous-lecture");
  });

  it("lien wa.me : encodage exact (retours à la ligne, & ? # % ’ é, emoji), jamais de « + »", () => {
    const text = `${whatsappMessage(event, APP)} 100 % 📚`;
    const href = whatsappUrl(text);
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
    expect(href).toContain("%0A");
    expect(href).not.toContain("+");
    expect(href.slice("https://wa.me/?text=".length)).not.toMatch(/[\s&?#]/);
    expect(decode(href)).toBe(text);
  });

  it("lieu à confirmer, date provisoire, titre très long tronqué", () => {
    const text = shareText({
      ...event,
      title: "T".repeat(300),
      location: null,
      isTentative: true,
    });
    const [title, when] = text.split("\n");
    expect(title).toHaveLength(120);
    expect(title!.endsWith("…")).toBe(true);
    expect(when).toContain("(date provisoire) · Lieu à confirmer");
  });

  it("jamais le lien de visio, même passé par erreur", () => {
    const leaky = { ...event, videoLink: "https://visio.exemple.sn/secret" } as ShareSource;
    expect(whatsappMessage(leaky, APP)).not.toContain("visio");
    expect(JSON.stringify(shareData(leaky, APP))).not.toContain("visio");
  });

  it("partage natif : titre, texte sans l'adresse, adresse à part", () => {
    expect(shareData(event, APP)).toEqual({
      title: event.title,
      text: shareText(event),
      url: "https://agora.test/events/rendez-vous-lecture",
    });
    expect(shareText(event)).not.toContain("https://");
  });

  it("e-mail de confirmation : ajouter à l'agenda (.ics et Google Agenda)", () => {
    const mail = registrationConfirmedEmail({
      to: "awa@exemple.test",
      name: "Awa",
      event: { title: "Rendez-vous", when: "samedi 5 décembre 2026, 18 h", place: "Dakar" },
      url: `${APP}/events/rendez-vous`,
      cancelBefore: null,
      calendar: {
        ics: `${APP}/events/rendez-vous/agenda.ics`,
        google: "https://calendar.google.com/calendar/render?action=TEMPLATE&text=x",
      },
    });
    expect(mail.text).toContain(
      `Ajouter à mon agenda (fichier .ics) : ${APP}/events/rendez-vous/agenda.ics`,
    );
    expect(mail.text).toContain("Ajouter à Google Agenda : https://calendar.google.com");
    expect(mail.html).toContain(`href="${APP}/events/rendez-vous/agenda.ics"`);
  });
});
