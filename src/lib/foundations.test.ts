import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { safeNextPath } from "@/config/auth";
import { setPasswordSchema, signInSchema } from "@/features/auth/schemas";
import { parseEnv } from "@/lib/env";
import { AppError, parseInput, runAction, toFailure } from "@/lib/errors";
import { maskEmail, redact } from "@/lib/logger";
import { activationEmail, escapeHtml } from "@/lib/mail/templates";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const { evaluate, rateLimitKey, rateLimits } = await import("@/lib/rate-limit");

const validEnv = {
  APP_URL: "http://localhost:3000/",
  DATABASE_URL: "postgresql://agora:agora@localhost:5433/agora",
  BETTER_AUTH_SECRET: "x".repeat(32),
  MAIL_FROM: "club@example.org",
};

describe("validation des variables d'environnement", () => {
  it("accepte une configuration minimale et applique les défauts", () => {
    const env = parseEnv(validEnv);
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.MAIL_PROVIDER).toBe("smtp");
    expect(env.SMTP_PORT).toBe(1025);
  });

  it("traite une variable vide comme absente", () => {
    expect(parseEnv({ ...validEnv, SMTP_PORT: "", SMTP_USER: "" }).SMTP_PORT).toBe(1025);
  });

  it("refuse un secret trop court, sans jamais afficher sa valeur", () => {
    expect(() => parseEnv({ ...validEnv, BETTER_AUTH_SECRET: "court-secret" })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
    try {
      parseEnv({ ...validEnv, BETTER_AUTH_SECRET: "court-secret" });
    } catch (error) {
      expect(String(error)).not.toContain("court-secret");
    }
  });

  it("exige la clé Resend si Resend est choisi, et https en production", () => {
    expect(() => parseEnv({ ...validEnv, MAIL_PROVIDER: "resend" })).toThrow(/RESEND_API_KEY/);
    expect(() =>
      parseEnv({ ...validEnv, NODE_ENV: "production", APP_URL: "http://agora.example.org" }),
    ).toThrow(/https/);
    expect(
      parseEnv({ ...validEnv, NODE_ENV: "production", APP_URL: "https://agora.example.org" })
        .APP_URL,
    ).toBe("https://agora.example.org");
  });

  it("signale toutes les variables manquantes", () => {
    expect(() => parseEnv({})).toThrow(/APP_URL[\s\S]*DATABASE_URL[\s\S]*BETTER_AUTH_SECRET/);
  });
});

describe("limitation de débit", () => {
  const rule = { limit: 5, windowSeconds: 900 };
  const start = new Date("2026-11-12T10:00:00Z");

  it("autorise jusqu'à la limite, refuse au-delà", () => {
    const now = new Date("2026-11-12T10:01:00Z");
    expect(evaluate(rule, 1, start, now)).toMatchObject({ allowed: true, remaining: 4 });
    expect(evaluate(rule, 5, start, now)).toMatchObject({ allowed: true, remaining: 0 });
    expect(evaluate(rule, 6, start, now)).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("indique le temps restant avant la fin de la fenêtre", () => {
    expect(evaluate(rule, 6, start, new Date("2026-11-12T10:05:00Z")).retryAfter).toBe(600);
    expect(evaluate(rule, 6, start, new Date("2026-11-12T10:14:59.5Z")).retryAfter).toBe(1);
  });

  it("la clé ne contient ni l'e-mail ni l'IP, et ignore la casse", () => {
    const key = rateLimitKey("auth.sign-in.email", "Awa.Diop@Example.org");
    expect(key).not.toMatch(/awa|example/i);
    expect(key).toBe(rateLimitKey("auth.sign-in.email", " awa.diop@example.org "));
    expect(key).not.toBe(rateLimitKey("auth.sign-in.ip", "awa.diop@example.org"));
  });

  it("la connexion est plus stricte par compte que par adresse IP", () => {
    expect(rateLimits["auth.sign-in.email"].limit).toBeLessThan(
      rateLimits["auth.sign-in.ip"].limit,
    );
  });
});

describe("gestion centralisée des erreurs", () => {
  it("parseInput renvoie les données valides et lève VALIDATION avec le détail par champ", () => {
    const schema = z.object({ email: z.email({ error: "E-mail invalide" }) });
    expect(parseInput(schema, { email: "a@b.sn" })).toEqual({ email: "a@b.sn" });
    try {
      parseInput(schema, { email: "pas-un-email" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("VALIDATION");
      expect((error as AppError).fieldErrors).toEqual({ email: "E-mail invalide" });
    }
  });

  it("runAction renvoie un résultat typé pour un succès et pour une erreur attendue", async () => {
    await expect(runAction("test", async () => 42)).resolves.toEqual({ ok: true, data: 42 });
    await expect(
      runAction("test", async () => {
        throw new AppError("RATE_LIMITED", undefined, { retryAfter: 60 });
      }),
    ).resolves.toMatchObject({ ok: false, code: "RATE_LIMITED", retryAfter: 60 });
  });

  it("une erreur inattendue est journalisée et remplacée par un message générique", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = toFailure(new Error("connexion refusée pour awa.diop@example.org"), "test");
    expect(failure).toMatchObject({ ok: false, code: "INTERNAL" });
    expect(failure.message).not.toContain("awa");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe("journal sans données privées", () => {
  it("masque les secrets, les données personnelles et les e-mails", () => {
    const out = redact({
      email: "awa.diop@example.org",
      password: "tuiles-et-gradins",
      resetToken: "abc123",
      phone: "+221770000000",
      nested: { authorization: "Bearer x", note: "écrire à moussa@example.org" },
    }) as Record<string, unknown>;
    expect(out.email).toBe("a***@example.org");
    expect(out.password).toBe("[masqué]");
    expect(out.resetToken).toBe("[masqué]");
    expect(out.phone).toBe("[donnée personnelle]");
    expect(JSON.stringify(out)).not.toMatch(/tuiles|abc123|Bearer|moussa|awa\.diop|7700/);
  });

  it("maskEmail garde le domaine, pas l'identifiant", () => {
    expect(maskEmail("contact: fatou@agora.sn")).toBe("contact: f***@agora.sn");
  });
});

describe("schémas d'authentification", () => {
  it("normalise l'e-mail et exige un mot de passe", () => {
    expect(signInSchema.parse({ email: "  Awa@Example.ORG ", password: "x" }).email).toBe(
      "awa@example.org",
    );
    expect(signInSchema.safeParse({ email: "awa@example.org", password: "" }).success).toBe(false);
  });

  it("refuse un mot de passe trop court ou une confirmation différente", () => {
    const token = "t".repeat(32);
    expect(
      setPasswordSchema.safeParse({ token, password: "court", confirmation: "court" }).success,
    ).toBe(false);
    const mismatch = setPasswordSchema.safeParse({
      token,
      password: "une phrase assez longue",
      confirmation: "une autre phrase",
    });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0]?.path).toEqual(["confirmation"]);
    expect(
      setPasswordSchema.safeParse({
        token,
        password: "une phrase assez longue",
        confirmation: "une phrase assez longue",
      }).success,
    ).toBe(true);
  });

  it("n'accepte comme retour après connexion qu'un chemin interne protégé", () => {
    expect(safeNextPath("/member")).toBe("/member");
    expect(safeNextPath("/admin/members?page=2")).toBe("/admin/members?page=2");
    for (const bad of [
      "//evil.example",
      "https://evil.example",
      "/login",
      "/memberx",
      "/\\evil",
      "",
      null,
    ]) {
      expect(safeNextPath(bad)).toBeNull();
    }
  });

  it("accepte la fiche d'une rencontre, et rien d'autre du site public", () => {
    expect(safeNextPath("/events/lancement-de-l-agora")).toBe("/events/lancement-de-l-agora");
    for (const bad of [
      "/events",
      "/events/",
      "/events/a/b",
      "/events/..",
      "/events/x?next=https://evil.example",
      "/events/Lancement",
      "/events/x%2F..%2F..%2Fevil",
      "/events//evil.example",
      `/events/${"a".repeat(121)}`,
      "/membership",
    ]) {
      expect(safeNextPath(bad), bad).toBeNull();
    }
  });

  it("refuse les chemins piégés vers un domaine externe ou hors de l'espace visé", () => {
    for (const bad of [
      "/\t/evil.example", // le navigateur efface la tabulation : « //evil.example »
      "/\n/evil.example",
      "/member/\r\nSet-Cookie: x=1", // injection d'en-tête dans `Location`
      "/member\t",
      "/admin/ ",
      "/member/../login",
      "/member/./x",
      "/member/..?x=1",
      "/%2F%2Fevil.example",
      "/%5Cevil.example",
      "https:/evil.example",
      "javascript:alert(1)",
      "/\u0000member",
    ]) {
      expect(safeNextPath(bad), JSON.stringify(bad)).toBeNull();
    }
    // Les vrais chemins de l'espace membre passent toujours.
    expect(safeNextPath("/member/events?page=2")).toBe("/member/events?page=2");
    expect(safeNextPath("/admin/members/ckabc..x")).toBe("/admin/members/ckabc..x");
  });
});

describe("gabarits d'e-mails", () => {
  it("échappe le contenu variable et fournit une version texte avec le lien", () => {
    expect(escapeHtml(`<b>"A&B"</b>`)).toBe("&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;");
    const mail = activationEmail({
      to: "awa@example.org",
      firstName: "<script>Awa",
      url: "http://localhost:3000/activate?token=abc",
      validDays: 7,
    });
    expect(mail.html).not.toContain("<script>Awa");
    expect(mail.html).toContain("&lt;script&gt;Awa");
    expect(mail.text).toContain("http://localhost:3000/activate?token=abc");
    expect(mail.subject).toContain("Activez votre compte");
  });
});
