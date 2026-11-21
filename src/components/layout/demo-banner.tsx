import { hasDemoData } from "@/lib/demo";

/** Bandeau discret affiché tant qu'il existe des lignes `isDemo` en base. */
export async function DemoBanner() {
  if (!(await hasDemoData())) return null;
  return (
    <p
      role="note"
      className="bg-sable px-5 py-1.5 text-center text-[0.8125rem] leading-snug font-semibold text-indigo"
    >
      Données de démonstration
      <span className="font-normal max-sm:hidden"> · livres, dates et articles sont fictifs</span>
    </p>
  );
}
