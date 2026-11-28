import { describe, expect, it } from "vitest";
import { eventReminderEmail } from "@/lib/mail/club-templates";

const base = {
  to: "awa@exemple.test",
  name: "Awa",
  event: {
    title: "Rendez-vous <lecture>",
    when: "samedi 5 décembre 2026, 18 h",
    place: "Maison de la culture",
  },
  dayAndTime: "demain à 18 h",
  audience: "member" as const,
  manageUrl: "https://agora.test/events/rv#inscription",
  videoLink: "https://visio.exemple.sn/rv",
  videoHidden: false,
  cardUrl: "https://agora.test/member/card",
  calendar: {
    ics: "https://agora.test/events/rv/agenda.ics",
    google: "https://calendar.google.com/calendar/render?action=TEMPLATE&text=x",
  },
  cancelBefore: "vendredi 4 décembre 2026 à 18 h",
  rescheduled: false,
  preferencesUrl: "https://agora.test/member/profile",
};

describe("e-mail de rappel la veille", () => {
  it("membre : date, lieu, visio, agenda, annulation, désactivation ; HTML échappé", () => {
    const mail = eventReminderEmail(base);
    expect(mail.subject).toBe("Rappel : Rendez-vous <lecture>, demain à 18 h");
    for (const part of [
      "samedi 5 décembre 2026, 18 h",
      "Maison de la culture",
      "Suivre la rencontre à distance : https://visio.exemple.sn/rv",
      "Ajouter à mon agenda (fichier .ics) : https://agora.test/events/rv/agenda.ics",
      "Ajouter à Google Agenda : https://calendar.google.com",
      "jusqu’au vendredi 4 décembre 2026 à 18 h",
      "Ne plus recevoir ces rappels : https://agora.test/member/profile",
      "Voir la rencontre : https://agora.test/events/rv#inscription",
    ]) {
      expect(mail.text).toContain(part);
    }
    expect(mail.html).toContain("Rendez-vous &lt;lecture&gt;");
    expect(mail.html).not.toContain("<lecture>");
    expect(mail.html).toContain(
      'href="https://calendar.google.com/calendar/render?action=TEMPLATE&amp;text=x"',
    );
  });

  it("visio masquée (carte non réglée après le délai) : pas de lien, renvoi vers la carte", () => {
    const mail = eventReminderEmail({ ...base, videoHidden: true });
    expect(mail.text).not.toContain("visio.exemple.sn");
    expect(mail.html).not.toContain("visio.exemple.sn");
    expect(mail.text).toContain("réservé aux membres dont la carte est réglée");
  });

  it("invité : jamais de visio, son lien personnel, pas de lien de profil ; horaire modifié", () => {
    const mail = eventReminderEmail({
      ...base,
      audience: "guest",
      videoLink: null,
      manageUrl: "https://agora.test/events/registration?token=abc",
      preferencesUrl: null,
      rescheduled: true,
      dayAndTime: "aujourd’hui à 18 h",
    });
    expect(mail.text).toContain(
      "Gérer mon inscription : https://agora.test/events/registration?token=abc",
    );
    expect(mail.text).not.toContain("visio");
    expect(mail.text).not.toContain("/member/profile");
    expect(mail.text).toContain("l’horaire de cette rencontre a changé");
    expect(mail.text).toContain("C’est le seul rappel envoyé pour cette inscription.");
    expect(mail.subject).toContain("aujourd’hui à 18 h");
  });
});
