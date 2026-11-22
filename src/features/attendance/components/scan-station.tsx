"use client";

import { useCallback, useRef, useState } from "react";
import { SidePanel } from "@/components/admin/side-panel";
import { Button } from "@/components/ui/button";
import { CameraScanner } from "@/features/attendance/components/camera-scanner";
import { ManualCheckIn } from "@/features/attendance/components/manual-check-in";
import {
  postScan,
  type ScanRequest,
  type ScanResponse,
} from "@/features/attendance/components/scan-api";
import { ScanResult } from "@/features/attendance/components/scan-result";
import { formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type StationEvent = {
  id: string;
  title: string;
  typeLabel: string;
  startsAt: string;
  confirmed: number;
  present: number;
};

type Recent = { key: number; name: string; time: string; ok: boolean; note: string };

/** Un même QR relu dans ce délai est ignoré : la carte reste souvent quelques secondes devant l'objectif. */
const SAME_TOKEN_COOLDOWN_MS = 4000;

/**
 * Poste de pointage : rencontre du jour, caméra, secours manuel, résultat en feuille du bas
 * (volet à droite sur ordinateur), et le fil des derniers pointages de cette session.
 */
export function ScanStation({
  events,
  canCollect,
  sessionFee,
}: {
  events: StationEvent[];
  canCollect: boolean;
  sessionFee: string;
}) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [presentByEvent, setPresentByEvent] = useState(
    () => new Map(events.map((event) => [event.id, event.present])),
  );
  const [collect, setCollect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [lastRequest, setLastRequest] = useState<ScanRequest | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const lastToken = useRef<{ token: string; at: number } | null>(null);
  const event = events.find((candidate) => candidate.id === eventId) ?? null;

  const submit = useCallback(async (request: ScanRequest) => {
    setBusy(true);
    setLastRequest(request);
    const response = await postScan(request);
    setBusy(false);
    setResult(response);
    setRefreshKey((key) => key + 1);
    if (response.ok) {
      navigator.vibrate?.(60);
      if (!response.alreadyPresent) {
        setPresentByEvent((map) =>
          new Map(map).set(request.eventId, (map.get(request.eventId) ?? 0) + 1),
        );
      }
    }
    setRecent((list) =>
      [
        {
          key: Date.now(),
          name: response.ok
            ? `${response.member.firstName} ${response.member.lastName}`
            : "Carte refusée",
          time: formatTime(new Date()),
          ok: response.ok,
          note: response.ok
            ? response.alreadyPresent
              ? "déjà pointé"
              : response.paid
                ? "présent, réglé"
                : "présent"
            : response.message,
        },
        ...list,
      ].slice(0, 8),
    );
  }, []);

  const onDecode = useCallback(
    (token: string) => {
      if (!eventId || busy || result) return;
      const now = Date.now();
      if (lastToken.current?.token === token && now - lastToken.current.at < SAME_TOKEN_COOLDOWN_MS)
        return;
      lastToken.current = { token, at: now };
      void submit({ mode: "token", eventId, token, paid: collect });
    },
    [busy, collect, eventId, result, submit],
  );

  const close = () => {
    setResult(null);
    lastToken.current = lastToken.current && { ...lastToken.current, at: Date.now() };
  };

  /** Encaisser après coup : même requête, case « payé » cochée (le serveur reste idempotent). */
  const collectNow = () => {
    if (!lastRequest) return;
    void submit({ ...lastRequest, paid: true });
  };

  if (!event) return null;
  const present = presentByEvent.get(event.id) ?? 0;

  return (
    <div className="grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-7">
        {events.length > 1 ? (
          <fieldset className="mb-5">
            <legend className="surtitre mb-2">Rencontre à pointer</legend>
            <div className="flex flex-col gap-2">
              {events.map((candidate) => (
                <label
                  key={candidate.id}
                  className={cn(
                    "flex min-h-14 cursor-pointer items-center gap-3 rounded-champ border px-4 py-2",
                    candidate.id === eventId ? "border-indigo bg-blanc" : "border-indigo/20",
                  )}
                >
                  <input
                    type="radio"
                    name="rencontre"
                    value={candidate.id}
                    checked={candidate.id === eventId}
                    onChange={() => setEventId(candidate.id)}
                    className="size-5 accent-indigo"
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold">{candidate.title}</span>
                  <span className="petit text-gris tabular-nums">
                    {formatTime(new Date(candidate.startsAt))}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="surtitre">
              {event.typeLabel} · {formatTime(new Date(event.startsAt))}
            </p>
            <p className="titre-3 mt-1 truncate">{event.title}</p>
          </div>
          <p className="shrink-0 text-right" aria-live="polite">
            <span className="font-serif text-[2.25rem] leading-none tabular-nums">{present}</span>
            <span className="font-serif text-[1.25rem] text-gris tabular-nums">
              {" "}
              / {event.confirmed}
            </span>
            <span className="petit block text-gris">présents</span>
          </p>
        </div>

        <CameraScanner paused={busy || result !== null} onDecode={onDecode} />

        {canCollect ? (
          <label className="mt-4 flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-champ bg-blanc px-4 py-3">
            <span>
              <span className="block font-semibold">Encaisser à chaque pointage</span>
              <span className="petit text-gris">Participation de {sessionFee}, en espèces</span>
            </span>
            <input
              type="checkbox"
              checked={collect}
              onChange={(e) => setCollect(e.target.checked)}
              className="size-6 shrink-0 accent-terracotta-fonce"
            />
          </label>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-10 lg:col-span-5">
        <section aria-labelledby="secours-titre">
          <h2 id="secours-titre" className="titre-3 mb-4">
            Sans caméra
          </h2>
          <ManualCheckIn
            eventId={event.id}
            busy={busy}
            refreshKey={refreshKey}
            onPickMember={(match) =>
              void submit({
                mode: "member",
                eventId: event.id,
                userId: match.userId,
                paid: collect,
              })
            }
            onToken={(token) =>
              void submit({ mode: "token", eventId: event.id, token, paid: collect })
            }
          />
        </section>

        {recent.length > 0 ? (
          <section aria-labelledby="fil-titre">
            <h2 id="fil-titre" className="surtitre mb-2">
              Derniers pointages
            </h2>
            <ol className="divide-y divide-trait border-y border-trait">
              {recent.map((item) => (
                <li key={item.key} className="flex items-baseline gap-3 py-2.5">
                  <span className="petit w-14 shrink-0 text-gris tabular-nums">{item.time}</span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate font-semibold",
                      !item.ok && "text-erreur",
                    )}
                  >
                    {item.name}
                  </span>
                  <span className="petit max-w-[45%] truncate text-gris">{item.note}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>

      <SidePanel
        open={result !== null}
        onClose={close}
        surtitre={result?.ok ? "Contrôle visuel" : "Scan"}
        title={result?.ok ? "Vérifiez l’identité" : "Pointage refusé"}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button variant="principal" size="lg" largeur="pleine" onClick={close} autoFocus>
              Pointer le suivant
            </Button>
            {result?.ok && !result.paid && canCollect ? (
              <Button
                variant="contour"
                size="lg"
                largeur="pleine"
                onClick={collectNow}
                disabled={busy}
              >
                Encaisser {sessionFee}
              </Button>
            ) : null}
          </div>
        }
      >
        {result ? <ScanResult result={result} /> : null}
      </SidePanel>
    </div>
  );
}
