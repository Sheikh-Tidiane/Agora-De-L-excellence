"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Lecture du QR code de la carte de membre par la caméra arrière.
 * Décodeur : `BarcodeDetector` du navigateur quand il lit les QR codes (Chrome Android) ;
 * sinon jsQR, chargé à la demande seulement (Safari, Firefox). Aucune image ne quitte le téléphone :
 * seul le texte décodé est transmis au parent.
 * La caméra ne démarre qu'au geste du responsable et s'arrête quand l'onglet passe en arrière-plan.
 */
type Decoder = (video: HTMLVideoElement) => Promise<string | null>;

type NativeDetector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type NativeDetectorClass = {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

/** Images analysées par seconde : assez pour une file d'attente, léger pour un téléphone modeste. */
const SCAN_INTERVAL_MS = 180;
/** Côté maximal de l'image passée à jsQR. */
const MAX_SIDE = 480;

async function createDecoder(): Promise<Decoder> {
  const Native = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
  if (Native) {
    const formats = (await Native.getSupportedFormats?.().catch(() => [])) ?? [];
    if (formats.includes("qr_code")) {
      const detector = new Native({ formats: ["qr_code"] });
      return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
    }
  }
  const jsQR = (await import("jsqr")).default;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!context || !video.videoWidth) return null;
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return (
      jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null
    );
  };
}

type CameraState = "idle" | "starting" | "active" | "denied" | "unavailable";

const messages: Partial<Record<CameraState, string>> = {
  denied:
    "La caméra est refusée. Autorisez-la dans les réglages du navigateur, ou pointez sans caméra ci-dessous.",
  unavailable:
    "Aucune caméra utilisable sur cet appareil (ou page non sécurisée). Pointez sans caméra ci-dessous.",
};

export function CameraScanner({
  paused,
  onDecode,
}: {
  /** Vrai pendant qu'un résultat est affiché : la caméra reste ouverte, la lecture s'arrête. */
  paused: boolean;
  onDecode: (text: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const pausedRef = useRef(paused);
  const onDecodeRef = useRef(onDecode);
  useEffect(() => {
    pausedRef.current = paused;
    onDecodeRef.current = onDecode;
  });

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setState((current) => (current === "active" || current === "starting" ? "idle" : current));
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setState("unavailable");
    setState("starting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
      setState("active");
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
    }
  }, []);

  // Boucle de lecture : une image toutes les 180 ms, jamais deux analyses en même temps.
  useEffect(() => {
    if (state !== "active") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let decode: Decoder | null = null;
    const tick = async () => {
      if (cancelled) return;
      try {
        decode ??= await createDecoder();
        const element = video.current;
        if (!pausedRef.current && element && element.readyState >= 2) {
          const text = await decode(element);
          if (text && !cancelled && !pausedRef.current) onDecodeRef.current(text);
        }
      } catch {
        // Image illisible ou décodeur indisponible un instant : on continue.
      }
      timer = setTimeout(tick, SCAN_INTERVAL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state]);

  // La caméra se coupe quand l'onglet passe en arrière-plan, et à la sortie de la page.
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && stop();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      stop();
    };
  }, [stop]);

  const active = state === "active";
  return (
    <div>
      <div
        className={cn(
          "relative isolate aspect-square w-full overflow-hidden rounded-feuille bg-indigo md:aspect-[4/3]",
        )}
      >
        <video
          ref={video}
          muted
          playsInline
          aria-label="Image de la caméra"
          className={cn("absolute inset-0 size-full object-cover", !active && "invisible")}
        />
        {/* Viseur : quatre angles en terracotta clair, le QR se place au milieu. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[16%] md:inset-x-[28%] md:inset-y-[14%]"
        >
          {[
            "top-0 left-0 border-t-4 border-l-4",
            "top-0 right-0 border-t-4 border-r-4",
            "bottom-0 left-0 border-b-4 border-l-4",
            "right-0 bottom-0 border-r-4 border-b-4",
          ].map((corner) => (
            <span
              key={corner}
              className={cn(
                "absolute size-9 rounded-[6px] border-terracotta-clair",
                corner,
                paused && "opacity-40",
              )}
            />
          ))}
        </div>
        {!active ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-ivoire">
            {state === "denied" || state === "unavailable" ? (
              <>
                <CameraOff aria-hidden="true" className="size-8 text-terracotta-clair" />
                <p role="status" className="max-w-[22rem] text-[0.9375rem] text-ivoire/85">
                  {messages[state]}
                </p>
                <Button variant="contour-clair" size="sm" onClick={() => void start()}>
                  Réessayer
                </Button>
              </>
            ) : (
              <>
                <p className="max-w-[18rem] text-[0.9375rem] text-ivoire/80">
                  Placez le QR code de la carte de membre dans le cadre.
                </p>
                <Button
                  variant="clair"
                  size="lg"
                  onClick={() => void start()}
                  disabled={state === "starting"}
                >
                  <Camera aria-hidden="true" />
                  {state === "starting" ? "Ouverture…" : "Activer la caméra"}
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>
      {active ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p role="status" className="petit text-gris">
            {paused ? "Lecture en pause." : "Lecture en cours : présentez la carte."}
          </p>
          <Button variant="discret" size="sm" onClick={stop}>
            Couper la caméra
          </Button>
        </div>
      ) : null}
    </div>
  );
}
