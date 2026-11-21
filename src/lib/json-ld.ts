/**
 * Données structurées (`<script type="application/ld+json">`) : JSON dont chaque « < » est échappé,
 * pour qu'un titre saisi dans l'administration (« </script><script>… ») ne ferme jamais la balise.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
