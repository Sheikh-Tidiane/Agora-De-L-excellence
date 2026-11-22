import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Block({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-14 scroll-mt-24 border-t border-indigo pt-6 lg:mt-20">
      <h2 className="surtitre mb-6">{title}</h2>
      {children}
    </section>
  );
}

export function Swatch({
  name,
  value,
  className,
  note,
}: {
  name: string;
  value: string;
  className: string;
  note: string;
}) {
  return (
    <li>
      <div className={cn("h-20 rounded-champ", className)} />
      <p className="mt-2 text-sm font-semibold">{name}</p>
      <p className="petit text-gris">
        {value}
        <br />
        {note}
      </p>
    </li>
  );
}
