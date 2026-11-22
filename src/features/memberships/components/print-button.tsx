"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Lance l'impression de la page : seule l'affiche (`.affiche`) est imprimée, voir globals.css. */
export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Printer aria-hidden="true" />
      Imprimer l’affiche
    </Button>
  );
}
