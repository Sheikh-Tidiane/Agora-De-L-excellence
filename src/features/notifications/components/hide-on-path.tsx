"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** N'affiche pas ses enfants sur une adresse donnée (le bandeau des non lues sur sa propre page). */
export function HideOnPath({ path, children }: { path: string; children: ReactNode }) {
  return usePathname() === path ? null : children;
}
