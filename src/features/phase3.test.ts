import { describe, expect, it } from "vitest";
import { articleDisplayState } from "@/features/articles/schemas";
import { refuseRoleChange, roleChanges } from "@/features/auth/roles-service";
import {
  canCancel,
  cancellationDeadline,
  holdsSeat,
  refuseRegistration,
  registrationWindow,
  seatsLeft,
  type EventForRules,
} from "@/features/events/rules";
import { eventSchema } from "@/features/events/schemas";
import { canTransition } from "@/features/events/service";
import {
  catalogFacets,
  filterBooks,
  joinAuthors,
  type PublicBook,
} from "@/features/library/catalog";
import { bookSchema, splitAuthors } from "@/features/library/schemas";
import { monthFromInput } from "@/features/library/service";
import { renewalStart } from "@/features/members/service";
import { membershipRequestSchema } from "@/features/memberships/schemas";
import { nextMemberNumber } from "@/features/memberships/service";
import { membershipState } from "@/features/memberships/status";
import {
  clubSettingsSchema,
  defaultClubSettings,
  mergeSettings,
} from "@/features/settings/schemas";
import { csvCell, toCsv } from "@/lib/csv";
import { eventDateParts, formatTime, monthStart, parseLocalDateTime } from "@/lib/dates";
import { parseMarkdown, readingMinutes, safeHref } from "@/lib/markdown";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { slugify, uniqueSlug } from "@/lib/slug";
import { sniffImage } from "@/lib/storage";
import { isStoredImage } from "@/lib/storage-names";

const HOUR = 3_600_000;
const now = new Date("2026-11-12T12:00:00Z");
const event = (overrides: Partial<EventForRules> = {}): EventForRules => ({
  status: "PUBLISHED",
  startsAt: new Date("2026-11-21T16:00:00Z"),
  capacity: 30,
  isPublic: true,
  cancellationDeadlineHours: null,
  ...overrides,
});

describe("inscriptions aux rencontres", () => {
  it("ouvre, ferme et refuse selon le statut et la date", () => {
    expect(registrationWindow(event(), now)).toBe("open");
    expect(registrationWindow(event({ status: "CLOSED" }), now)).toBe("closed");
    expect(registrationWindow(event({ status: "CANCELLED" }), now)).toBe("cancelled");
    expect(registrationWindow(event({ status: "DRAFT" }), now)).toBe("unpublished");
    expect(registrationWindow(event({ startsAt: now }), now)).toBe("past");
  });

  it("respecte la capacité, sans jamais descendre sous zéro", () => {
    expect(seatsLeft(30, 12)).toBe(18);
    expect(seatsLeft(30, 31)).toBe(0);
    expect(seatsLeft(null, 500)).toBeNull();
    expect(refuseRegistration(event(), 29, now, "member")).toBeNull();
    expect(refuseRegistration(event(), 30, now, "member")).toBe("FULL");
    expect(refuseRegistration(event({ capacity: null }), 999, now, "guest")).toBeNull();
  });

  it("réserve aux membres les rencontres non publiques", () => {
    expect(refuseRegistration(event({ isPublic: false }), 0, now, "guest")).toBe("MEMBERS_ONLY");
    expect(refuseRegistration(event({ isPublic: false }), 0, now, "member")).toBeNull();
    expect(refuseRegistration(event({ status: "CLOSED" }), 0, now, "member")).toBe("CLOSED");
    expect(
      refuseRegistration(event({ startsAt: new Date(now.getTime() - 1) }), 0, now, "member"),
    ).toBe("PAST");
  });

  it("permet d'annuler jusqu'à 24 h avant, ou selon le délai propre à l'événement", () => {
    const e = event();
    expect(cancellationDeadline(e, 24).toISOString()).toBe("2026-11-20T16:00:00.000Z");
    expect(canCancel(e, new Date("2026-11-20T16:00:00Z"), 24)).toBe(true);
    expect(canCancel(e, new Date("2026-11-20T16:00:01Z"), 24)).toBe(false);
    expect(
      canCancel(event({ cancellationDeadlineHours: 2 }), new Date("2026-11-21T13:59:00Z"), 24),
    ).toBe(true);
    expect(canCancel(event({ status: "CANCELLED" }), now, 24)).toBe(false);
  });

  it("ne retient la place d'un invité non confirmé que 24 h", () => {
    expect(holdsSeat({ status: "CONFIRMED", updatedAt: new Date(0) }, now)).toBe(true);
    expect(holdsSeat({ status: "CANCELLED", updatedAt: now }, now)).toBe(false);
    expect(
      holdsSeat({ status: "PENDING", updatedAt: new Date(now.getTime() - 23 * HOUR) }, now),
    ).toBe(true);
    expect(
      holdsSeat({ status: "PENDING", updatedAt: new Date(now.getTime() - 25 * HOUR) }, now),
    ).toBe(false);
  });

  it("n'autorise que les changements de statut prévus", () => {
    expect(canTransition("DRAFT", "PUBLISHED")).toBe(true);
    expect(canTransition("DRAFT", "CLOSED")).toBe(false);
    expect(canTransition("PUBLISHED", "CANCELLED")).toBe(true);
    expect(canTransition("CANCELLED", "CLOSED")).toBe(false);
  });

  it("valide la fiche d'un événement côté serveur", () => {
    const base = {
      title: "Rencontre",
      type: "RENDEZ_VOUS_LECTURE",
      activities: ["RENDEZ_VOUS_LECTURE"],
      summary: "",
      description: "Une description assez longue.",
      location: "",
      isTentative: false,
      program: "",
      speakerName: "",
      speakerTitle: "",
      speakerMode: "",
      videoLink: "",
      startsAt: "2026-11-21T16:00",
      endsAt: "",
      capacity: "",
      isPublic: true,
      cancellationDeadlineHours: "",
    };
    const ok = eventSchema.parse(base);
    expect(ok.startsAt.toISOString()).toBe("2026-11-21T16:00:00.000Z");
    expect(ok.capacity).toBeNull();
    expect(eventSchema.safeParse({ ...base, capacity: "0" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, capacity: "abc" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, startsAt: "" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, endsAt: "2026-11-21T15:00" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, type: "PARTY" }).success).toBe(false);
  });
});

describe("adhésion", () => {
  const request = {
    firstName: "Awa",
    lastName: "Diop",
    email: " Awa@Example.org ",
    phone: "77 123 45 67",
    ageRange: "FROM_18_TO_25",
    occupation: "STUDENT",
    interests: ["READING"],
    motivation: "",
    guardianName: "",
    guardianPhone: "",
    consent: true,
    charter: true,
  };

  it("normalise l'e-mail et le téléphone", () => {
    const data = membershipRequestSchema.parse(request);
    expect(data.email).toBe("awa@example.org");
    expect(data.phone).toBe("+221771234567");
  });

  it("exige le consentement, un centre d'intérêt et un e-mail valide", () => {
    expect(membershipRequestSchema.safeParse({ ...request, consent: false }).success).toBe(false);
    expect(membershipRequestSchema.safeParse({ ...request, charter: false }).success).toBe(false);
    expect(membershipRequestSchema.safeParse({ ...request, interests: [] }).success).toBe(false);
    expect(membershipRequestSchema.safeParse({ ...request, email: "awa@" }).success).toBe(false);
    expect(membershipRequestSchema.safeParse({ ...request, phone: "12" }).success).toBe(false);
  });

  it("exige un parent ou tuteur pour un mineur", () => {
    const minor = { ...request, ageRange: "FROM_15_TO_17" };
    const result = membershipRequestSchema.safeParse(minor);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      "guardianName",
      "guardianPhone",
    ]);
    expect(
      membershipRequestSchema.safeParse({
        ...minor,
        guardianName: "Fatou Diop",
        guardianPhone: "+221 70 000 00 00",
      }).success,
    ).toBe(true);
  });

  it("numérote les membres par année", () => {
    expect(nextMemberNumber(2026, null)).toBe("AE-2026-0001");
    expect(nextMemberNumber(2026, "AE-2026-0041")).toBe("AE-2026-0042");
    expect(nextMemberNumber(2027, "AE-2026-0041")).toBe("AE-2027-0001");
  });

  it("déduit l'état d'adhésion de la période la plus récente", () => {
    expect(membershipState(null, now).kind).toBe("none");
    expect(
      membershipState({ status: "ACTIVE", endsAt: new Date("2027-11-12Z") }, now),
    ).toMatchObject({ kind: "active", expiresSoon: false });
    expect(
      membershipState({ status: "ACTIVE", endsAt: new Date("2026-11-20Z") }, now),
    ).toMatchObject({ kind: "active", expiresSoon: true });
    expect(membershipState({ status: "ACTIVE", endsAt: new Date("2026-11-01Z") }, now).kind).toBe(
      "expired",
    );
    expect(
      membershipState({ status: "SUSPENDED", endsAt: new Date("2027-01-01Z") }, now).kind,
    ).toBe("suspended");
  });

  it("enchaîne un renouvellement à la suite de la période en cours", () => {
    const end = new Date("2027-01-01Z");
    expect(renewalStart(end, now)).toBe(end);
    expect(renewalStart(new Date("2026-01-01Z"), now)).toBe(now);
    expect(renewalStart(null, now)).toBe(now);
  });
});

describe("rôles", () => {
  it("calcule les rôles ajoutés et retirés", () => {
    expect(roleChanges(["member", "library"], ["member", "admin"])).toEqual({
      added: ["admin"],
      removed: ["library"],
    });
  });

  it("protège le dernier super-administrateur et son propre rôle", () => {
    expect(
      refuseRoleChange({ isSelf: false, removed: ["library"], otherSuperAdmins: 0 }),
    ).toBeNull();
    expect(
      refuseRoleChange({ isSelf: true, removed: ["super_admin"], otherSuperAdmins: 3 }),
    ).toMatch(/vous retirer/);
    expect(
      refuseRoleChange({ isSelf: false, removed: ["super_admin"], otherSuperAdmins: 0 }),
    ).toMatch(/au moins un/);
    expect(
      refuseRoleChange({ isSelf: false, removed: ["super_admin"], otherSuperAdmins: 1 }),
    ).toBeNull();
  });
});

describe("bibliothèque", () => {
  const book = (overrides: Partial<PublicBook>): PublicBook => ({
    id: "1",
    slug: "une-si-longue-lettre",
    title: "Une si longue lettre",
    subtitle: null,
    summary: "",
    clubNote: null,
    isClubFavorite: false,
    category: { slug: "senegal", name: "Littérature sénégalaise" },
    authors: [{ slug: "mariama-ba", name: "Mariama Bâ", bio: null }],
    authorNames: "Mariama Bâ",
    coverImage: null,
    publisher: null,
    publishedYear: 1979,
    pageCount: null,
    language: "fr",
    isbn: null,
    ...overrides,
  });
  const books = [
    book({}),
    book({
      id: "2",
      slug: "l-enfant-noir",
      title: "L’Enfant noir",
      category: { slug: "afrique", name: "Littérature africaine" },
      authors: [{ slug: "camara-laye", name: "Camara Laye", bio: null }],
      authorNames: "Camara Laye",
    }),
  ];

  it("cherche sans tenir compte des accents ni de la casse", () => {
    expect(filterBooks(books, { q: "ba" }).map((b) => b.id)).toEqual(["1"]);
    expect(filterBooks(books, { q: "ENFANT" }).map((b) => b.id)).toEqual(["2"]);
    expect(filterBooks(books, { q: "l'enfant laye" }).map((b) => b.id)).toEqual(["2"]);
    expect(filterBooks(books, { q: "introuvable" })).toEqual([]);
  });

  it("filtre par catégorie et par auteur", () => {
    expect(filterBooks(books, { category: "afrique" }).map((b) => b.id)).toEqual(["2"]);
    expect(filterBooks(books, { author: "mariama-ba" }).map((b) => b.id)).toEqual(["1"]);
    expect(filterBooks(books, { category: "afrique", author: "mariama-ba" })).toEqual([]);
    expect(catalogFacets(books).categories.map((c) => c.name)).toEqual([
      "Littérature africaine",
      "Littérature sénégalaise",
    ]);
  });

  it("assemble et découpe les noms d'auteurs", () => {
    expect(joinAuthors(["A", "B", "C"])).toBe("A, B et C");
    expect(joinAuthors([])).toBe("Auteur inconnu");
    expect(splitAuthors(" Mariama Bâ ,  mariama bâ; Aminata  Sow Fall ")).toEqual([
      "Mariama Bâ",
      "Aminata Sow Fall",
    ]);
  });

  it("valide une fiche de livre et refuse une image inconnue", () => {
    const input = {
      id: "",
      title: "Titre",
      subtitle: "",
      authors: "Mariama Bâ",
      categoryId: "c1",
      summary: "Un résumé rédigé pour le club.",
      clubNote: "",
      isClubFavorite: false,
      isPublished: true,
      publisher: "",
      publishedYear: "1979",
      pageCount: "",
      isbn: "",
      language: "fr",
      coverImage: "",
    };
    expect(bookSchema.parse(input).publishedYear).toBe(1979);
    expect(bookSchema.safeParse({ ...input, authors: " , " }).success).toBe(false);
    expect(bookSchema.safeParse({ ...input, publishedYear: "79" }).success).toBe(false);
    expect(bookSchema.safeParse({ ...input, coverImage: "../../etc/passwd" }).success).toBe(false);
    expect(
      bookSchema.safeParse({ ...input, coverImage: `covers/${"a".repeat(32)}.jpg` }).success,
    ).toBe(true);
    expect(monthFromInput("2026-11").toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
});

describe("articles et Markdown", () => {
  it("distingue brouillon, programmé, en ligne et archivé", () => {
    expect(articleDisplayState({ status: "DRAFT", publishedAt: null }, now)).toBe("draft");
    expect(
      articleDisplayState({ status: "PUBLISHED", publishedAt: new Date("2026-12-01Z") }, now),
    ).toBe("scheduled");
    expect(
      articleDisplayState({ status: "PUBLISHED", publishedAt: new Date("2026-11-01Z") }, now),
    ).toBe("published");
    expect(
      articleDisplayState({ status: "ARCHIVED", publishedAt: new Date("2026-11-01Z") }, now),
    ).toBe("archived");
  });

  it("découpe le Markdown en blocs", () => {
    const blocks = parseMarkdown(
      "## Titre\n\nUn paragraphe\nsur deux lignes.\n\n- un\n- deux\n\n> citation\n\n1. premier",
    );
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "quote", "list"]);
    expect(blocks[1]).toEqual({ type: "paragraph", text: "Un paragraphe sur deux lignes." });
    expect(blocks[4]).toMatchObject({ ordered: true, items: ["premier"] });
  });

  it("n'accepte que des liens sûrs", () => {
    expect(safeHref("https://example.org")).toBe("https://example.org");
    expect(safeHref("/events")).toBe("/events");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//evil.example")).toBeNull();
    expect(readingMinutes("mot ".repeat(450))).toBe(2);
    expect(readingMinutes("court")).toBe(1);
  });
});

describe("outils", () => {
  it("normalise les numéros sénégalais", () => {
    expect(normalizePhone("77 123 45 67")).toBe("+221771234567");
    expect(normalizePhone("+221 33 800 00 00")).toBe("+221338000000");
    expect(normalizePhone("00221771234567")).toBe("+221771234567");
    expect(normalizePhone("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("+221 12 345 67 89")).toBeNull();
    expect(formatPhone("+221771234567")).toBe("+221 77 123 45 67");
  });

  it("fabrique des slugs lisibles et uniques", async () => {
    expect(slugify("L’Aventure ambiguë")).toBe("l-aventure-ambigue");
    expect(slugify("  Débat : faut-il lire ?  ")).toBe("debat-faut-il-lire");
    const taken = new Set(["debat", "debat-2"]);
    expect(await uniqueSlug("Débat", async (slug) => taken.has(slug))).toBe("debat-3");
    expect(await uniqueSlug("???", async () => false, "article")).toBe("article");
  });

  it("formate les dates à l'heure de Dakar", () => {
    expect(formatTime(new Date("2026-11-21T16:00:00Z"))).toBe("16\u00a0h");
    expect(formatTime(new Date("2026-11-21T16:30:00Z"))).toBe("16\u00a0h\u00a030");
    expect(eventDateParts(new Date("2026-11-21T16:00:00Z"))).toMatchObject({
      day: "21",
      weekday: "Samedi",
    });
    expect(monthStart(new Date("2026-11-21T16:00:00Z")).toISOString()).toBe(
      "2026-11-01T00:00:00.000Z",
    );
    expect(parseLocalDateTime("2026-11-21T16:00")?.toISOString()).toBe("2026-11-21T16:00:00.000Z");
    expect(parseLocalDateTime("demain")).toBeNull();
  });

  it("neutralise les formules et échappe les cellules CSV", () => {
    expect(csvCell("=SOMME(A1)")).toBe("'=SOMME(A1)");
    expect(csvCell('Diop; "Awa"')).toBe('"Diop; ""Awa"""');
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a", "b"], [["1", 2]])).toBe("﻿a;b\r\n1;2\r\n");
  });

  it("reconnaît une image à son contenu, pas à son nom", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe(
      "image/png",
    );
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("MZ exécutable"))).toBeNull();
    expect(isStoredImage("covers/../secret.jpg")).toBe(false);
  });

  it("fusionne les réglages et ignore une valeur invalide", () => {
    const merged = mergeSettings([
      { key: "club.name", value: "Le Club" },
      { key: "events.cancellationDeadlineHours", value: 48 },
      { key: "social.facebook", value: "pas une adresse" },
    ]);
    expect(merged.name).toBe("Le Club");
    expect(merged.cancellationDeadlineHours).toBe(48);
    expect(merged.facebook).toBe("");
    expect(
      clubSettingsSchema.safeParse({ ...defaultClubSettings, instagram: "http://insta" }).success,
    ).toBe(false);
    expect(
      clubSettingsSchema.safeParse({ ...defaultClubSettings, membershipDurationMonths: "0" })
        .success,
    ).toBe(false);
  });
});
