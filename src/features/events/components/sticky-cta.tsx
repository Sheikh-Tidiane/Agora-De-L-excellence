"use client";

import { useEffect, useState } from "react";

/**
 * Mobile : l'action principale reste sous le pouce, et s'efface dès que la cible
 * (le bloc d'inscription) entre dans l'écran, pour ne jamais masquer un champ.
 */
export function StickyCta({ targetId, children }: { targetId: string; children: string }) {
  const [targetVisible, setTargetVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setTargetVisible(Boolean(entry?.isIntersecting)),
      { rootMargin: "0px 0px -80px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  if (targetVisible) return null;
  return (
    <a
      href={`#${targetId}`}
      className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex h-13 items-center justify-center rounded-champ bg-terracotta-fonce font-semibold text-blanc shadow-posee lg:hidden"
    >
      {children}
    </a>
  );
}
