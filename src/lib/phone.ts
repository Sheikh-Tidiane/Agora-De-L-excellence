/**
 * Numéros de téléphone au format E.164, Sénégal (+221) par défaut.
 * « 77 123 45 67 » → « +221771234567 ». Un numéro étranger doit commencer par + ou 00.
 * `null` si le numéro n'est pas plausible.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim().replace(/[\s.\-()]/g, "");
  if (!raw) return null;
  let digits: string;
  if (raw.startsWith("+")) digits = raw.slice(1);
  else if (raw.startsWith("00")) digits = raw.slice(2);
  else if (/^\d{9}$/.test(raw)) digits = `221${raw}`;
  else return null;
  if (!/^\d{8,15}$/.test(digits)) return null;
  // Sénégal : 9 chiffres après l'indicatif, mobiles en 7x, fixes en 3x.
  if (digits.startsWith("221") && !/^221[37]\d{8}$/.test(digits)) return null;
  return `+${digits}`;
}

/** « +221771234567 » → « +221 77 123 45 67 ». Les autres numéros sont laissés tels quels. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const match = /^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  return match ? `+221 ${match[1]} ${match[2]} ${match[3]} ${match[4]}` : e164;
}
