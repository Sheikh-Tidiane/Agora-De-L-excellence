import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Jeton du QR code de la carte de membre : opaque, signé, sans donnée personnelle.
 * Fonctions pures, sans base ni Next.js. Le service (lecture du membre, révocation, image) est
 * dans `card-service.ts`. Choix et justification : docs/DECISIONS.md, section 10.
 *
 * Format : `A1.<série>.<version>.<signature>`
 * - `A1`        : version du format (permet d'en changer un jour sans ambiguïté) ;
 * - `<série>`   : 12 octets aléatoires propres à la carte (base64url, 16 caractères), sans lien
 *                 avec l'identifiant du compte ni le numéro de membre ;
 * - `<version>` : entier ≥ 1 ; l'augmenter en base révoque toutes les cartes émises avant ;
 * - `<signature>` : HMAC-SHA256 des trois premiers champs, tronqué à 128 bits (base64url, 22 caractères).
 * Environ 45 caractères, tous URL-safe : le QR reste petit et se lit vite, même sur un écran abîmé.
 */
export const CARD_TOKEN_PREFIX = "A1";
const SERIAL_BYTES = 12;
const MAC_BYTES = 16;
/** Au-delà, la chaîne n'est même pas examinée (évite de travailler sur une entrée démesurée). */
export const CARD_TOKEN_MAX_LENGTH = 64;
const VERSION_MAX = 999_999_999;

const TOKEN_PATTERN = /^A1\.([A-Za-z0-9_-]{16})\.([1-9][0-9]{0,8})\.([A-Za-z0-9_-]{22})$/;
const SERIAL_PATTERN = /^[A-Za-z0-9_-]{16}$/;

export type CardTokenPayload = { serial: string; version: number };

/**
 * Clé de signature des cartes, dérivée du secret de l'application par HKDF-SHA256.
 * Séparation de domaine : la clé des cartes n'est jamais la clé des sessions ni celle du limiteur.
 */
export function deriveCardKey(secret: string): Buffer {
  if (secret.length < 32) throw new Error("Secret trop court pour signer les cartes de membre.");
  return Buffer.from(hkdfSync("sha256", secret, "agora-excellence", "member-card-token/v1", 32));
}

/** Nouveau numéro de série de carte : aléatoire, imprévisible, sans signification. */
export function newCardSerial(): string {
  return randomBytes(SERIAL_BYTES).toString("base64url");
}

function mac(key: Buffer, body: string): string {
  return createHmac("sha256", key)
    .update(body)
    .digest()
    .subarray(0, MAC_BYTES)
    .toString("base64url");
}

/** Fabrique le jeton d'une carte. */
export function signCardToken(payload: CardTokenPayload, key: Buffer): string {
  if (!SERIAL_PATTERN.test(payload.serial)) throw new Error("Numéro de série de carte invalide.");
  if (!Number.isInteger(payload.version) || payload.version < 1 || payload.version > VERSION_MAX) {
    throw new Error("Version de carte invalide.");
  }
  const body = `${CARD_TOKEN_PREFIX}.${payload.serial}.${payload.version}`;
  return `${body}.${mac(key, body)}`;
}

export type CardTokenCheck =
  { ok: true; payload: CardTokenPayload } | { ok: false; reason: "malformed" | "bad_signature" };

/**
 * Lit et authentifie un jeton, sans base de données : un jeton falsifié est rejeté ici,
 * avant toute recherche (pas d'oracle sur l'existence d'une carte).
 * Les blancs autour (retour à la ligne ajouté par certains lecteurs) sont tolérés.
 */
export function checkCardToken(raw: unknown, key: Buffer): CardTokenCheck {
  if (typeof raw !== "string" || raw.length > CARD_TOKEN_MAX_LENGTH + 8) {
    return { ok: false, reason: "malformed" };
  }
  const token = raw.trim();
  const match = TOKEN_PATTERN.exec(token);
  if (!match) return { ok: false, reason: "malformed" };
  const [, serial, versionText, signature] = match as unknown as [string, string, string, string];
  const expected = Buffer.from(mac(key, `${CARD_TOKEN_PREFIX}.${serial}.${versionText}`));
  const given = Buffer.from(signature);
  // Même longueur garantie par le motif ; comparaison en temps constant.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true, payload: { serial, version: Number(versionText) } };
}
