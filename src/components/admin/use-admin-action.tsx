"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck } from "lucide-react";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";

type Notice = { tone: "succes" | "erreur"; text: string };

/**
 * Exécute une Server Action depuis l'administration : état d'attente, message de confirmation
 * ou d'erreur (annoncé aux lecteurs d'écran), puis rafraîchissement des données de la page.
 */
export function useAdminAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice>();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), notice.tone === "erreur" ? 9000 : 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const run = useCallback(
    <T,>(
      action: () => Promise<ActionResult<T>>,
      options: { success?: string | ((data: T) => string); onSuccess?: (data: T) => void } = {},
    ) =>
      new Promise<boolean>((resolve) => {
        startTransition(async () => {
          const result = await action();
          if (result.ok) {
            const text =
              typeof options.success === "function"
                ? options.success(result.data)
                : options.success;
            if (text) setNotice({ tone: "succes", text });
            options.onSuccess?.(result.data);
            router.refresh();
            resolve(true);
          } else {
            setNotice({ tone: "erreur", text: result.message });
            resolve(false);
          }
        });
      }),
    [router],
  );

  const toast = notice ? (
    <div
      role={notice.tone === "erreur" ? "alert" : "status"}
      className={cn(
        "fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-md items-start gap-2.5 rounded-champ px-4 py-3 text-[0.9375rem] font-semibold shadow-posee md:right-8 md:left-auto md:mx-0",
        notice.tone === "erreur" ? "bg-erreur text-blanc" : "bg-indigo text-ivoire",
      )}
    >
      {notice.tone === "erreur" ? (
        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      ) : (
        <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      )}
      <span>{notice.text}</span>
    </div>
  ) : null;

  return { run, pending, toast, notify: setNotice };
}
