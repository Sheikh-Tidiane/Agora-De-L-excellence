/** Montant en francs CFA : « 1 000 F CFA » (espaces insécables). */
export function formatFcfa(amount: number): string {
  const digits = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
  return `${digits}\u00a0F\u00a0CFA`;
}
