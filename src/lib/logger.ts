/**
 * Journal technique. Une ligne JSON par événement, sans donnée privée :
 * les clés sensibles sont masquées et les adresses e-mail tronquées avant l'écriture.
 */
type Level = "debug" | "info" | "warn" | "error";
type Context = Record<string, unknown>;

const SECRET_KEYS = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|hash/i;
const PERSONAL_KEYS = /^(phone|guardianPhone|ipAddress|ip|address)$/i;
const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/** `awa.diop@example.org` → `a***@example.org` */
export function maskEmail(value: string): string {
  return value.replace(EMAIL, "$1***@$2");
}

/** Copie d'un contexte de log débarrassée des secrets et des données personnelles. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return maskEmail(value);
  if (typeof value !== "object") return value;
  if (depth > 4) return "[tronqué]";
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: maskEmail(value.message) };
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Context).map(([key, v]) => {
      if (SECRET_KEYS.test(key)) return [key, "[masqué]"];
      if (PERSONAL_KEYS.test(key)) return [key, "[donnée personnelle]"];
      return [key, redact(v, depth + 1)];
    }),
  );
}

function write(level: Level, message: string, context?: Context) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message: maskEmail(message),
    ...(context ? (redact(context) as Context) : {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: Context) => write("debug", message, context),
  info: (message: string, context?: Context) => write("info", message, context),
  warn: (message: string, context?: Context) => write("warn", message, context),
  /** `error` peut être n'importe quelle valeur levée : seuls son nom, son message et sa pile sont gardés. */
  error: (message: string, error?: unknown, context?: Context) =>
    write("error", message, {
      ...context,
      ...(error instanceof Error
        ? { error: { name: error.name, message: error.message }, stack: error.stack }
        : error !== undefined
          ? { error: String(error) }
          : {}),
    }),
};
