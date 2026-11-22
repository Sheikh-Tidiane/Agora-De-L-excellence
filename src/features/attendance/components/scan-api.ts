/**
 * Appels du navigateur aux Route Handlers du scan. Les réponses JSON sont typées ici :
 * dates en chaînes ISO, comme elles arrivent.
 */
export type ScanSuccess = {
  ok: true;
  member: {
    firstName: string;
    lastName: string;
    memberNumber: string | null;
    photoUrl: string | null;
    cardPaid: boolean;
  };
  registrationId: string;
  alreadyPresent: boolean;
  attendedAt: string;
  method: "QR_SCAN" | "MANUAL";
  paid: boolean;
  pointsAwarded: number;
  badges: string[];
};

export type ScanRefusal = { ok: false; reason?: string; message: string };
export type ScanResponse = ScanSuccess | ScanRefusal;

export type ScanRequest =
  | { mode: "token"; eventId: string; token: string; paid: boolean }
  | { mode: "member"; eventId: string; userId: string; paid: boolean };

const offline: ScanRefusal = {
  ok: false,
  message: "Connexion impossible. Vérifiez le réseau et réessayez.",
};

export async function postScan(body: ScanRequest): Promise<ScanResponse> {
  try {
    const response = await fetch("/api/admin/attendance/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as ScanResponse | null;
    return data && typeof data.ok === "boolean" ? data : offline;
  } catch {
    return offline;
  }
}

export type RegistrantMatch = {
  userId: string;
  firstName: string;
  lastName: string;
  memberNumber: string | null;
  present: boolean;
};

export async function searchRegistrants(
  eventId: string,
  q: string,
  signal?: AbortSignal,
): Promise<{ ok: true; matches: RegistrantMatch[] } | ScanRefusal> {
  try {
    // POST : le nom cherché ne s'écrit pas dans l'adresse (ni dans les journaux du serveur).
    const response = await fetch("/api/admin/attendance/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, q }),
      signal,
    });
    const data = (await response.json().catch(() => null)) as
      { ok: true; matches: RegistrantMatch[] } | ScanRefusal | null;
    return data && typeof data.ok === "boolean" ? data : offline;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return offline;
  }
}
