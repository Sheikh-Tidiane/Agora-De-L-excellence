import { z } from "zod";

/**
 * Variables d'environnement, validées une fois au démarrage.
 * Toute nouvelle variable s'ajoute ici ET dans `.env.example`.
 * Ce module ne doit jamais être importé par un composant client.
 */
const vide = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z
      .url({ error: "APP_URL doit être une URL complète (ex. http://localhost:3000)" })
      .transform((url) => url.replace(/\/+$/, "")),
    DATABASE_URL: z
      .string({ error: "DATABASE_URL est requise" })
      .regex(/^postgres(ql)?:\/\//, "DATABASE_URL doit commencer par postgresql://"),
    BETTER_AUTH_SECRET: z
      .string({ error: "BETTER_AUTH_SECRET est requis" })
      .min(32, "BETTER_AUTH_SECRET doit faire au moins 32 caractères"),

    MAIL_PROVIDER: z.enum(["smtp", "resend"]).default("smtp"),
    MAIL_FROM: z.email({ error: "MAIL_FROM doit être une adresse e-mail" }),
    SMTP_HOST: z.preprocess(vide, z.string().default("127.0.0.1")),
    SMTP_PORT: z.preprocess(vide, z.coerce.number().int().min(1).max(65535).default(1025)),
    SMTP_SECURE: z.preprocess(vide, z.enum(["true", "false"]).default("false")),
    SMTP_USER: z.preprocess(vide, z.string().optional()),
    SMTP_PASSWORD: z.preprocess(vide, z.string().optional()),
    RESEND_API_KEY: z.preprocess(vide, z.string().optional()),

    /** Destinataire du formulaire de contact, tant que l'admin n'a pas saisi l'adresse du club. */
    CONTACT_EMAIL: z.preprocess(vide, z.email().optional()),
    /** Dossier des images téléversées (hors dépôt). */
    UPLOAD_DIR: z.preprocess(vide, z.string().default("uploads")),

    MAILPIT_URL: z.preprocess(vide, z.url().optional()),

    /** Assistant IA. Sans clé, l'application démarre et affiche « Assistant non connecté ». */
    LLM_PROVIDER: z.preprocess(vide, z.enum(["principal"]).default("principal")),
    LLM_API_KEY: z.preprocess(vide, z.string().optional()),
    /** Identifiant du modèle chez le fournisseur. Sans lui, l'assistant reste « non connecté ». */
    LLM_MODEL: z.preprocess(vide, z.string().min(1).max(100).optional()),
    /** Questions permises par membre et par jour (jour de Dakar). */
    ASSISTANT_DAILY_LIMIT: z.preprocess(vide, z.coerce.number().int().min(1).max(500).default(20)),
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_PROVIDER === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "RESEND_API_KEY est requise quand MAIL_PROVIDER vaut « resend »",
      });
    }
    if (env.NODE_ENV === "production" && !env.APP_URL.startsWith("https://")) {
      // HTTPS obligatoire en production (cahier des charges §11.2). `localhost` reste permis pour tester un build.
      if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(env.APP_URL)) {
        ctx.addIssue({
          code: "custom",
          path: ["APP_URL"],
          message: "APP_URL doit être en https:// en production",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Valide un jeu de variables. Exportée pour les tests. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".") || "(racine)"} : ${issue.message}`,
    );
    // Les valeurs ne sont jamais affichées : seulement le nom de la variable et la raison.
    throw new Error(
      `Configuration invalide. Vérifiez le fichier .env (modèle : .env.example).\n${lines.join("\n")}`,
    );
  }
  return result.data;
}

let cache: Env | undefined;

/** Variables validées. La validation a lieu au premier accès, puis le résultat est conservé. */
export function getEnv(): Env {
  cache ??= parseEnv(process.env);
  return cache;
}

/** Accès paresseux : `env.APP_URL`. Un import seul ne déclenche pas la validation. */
export const env = new Proxy({} as Env, {
  get: (_target, key: string) => getEnv()[key as keyof Env],
});
