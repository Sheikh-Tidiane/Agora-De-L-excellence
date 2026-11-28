import { NextResponse } from "next/server";
import { failureResponse } from "@/features/attendance/http";
import { scanRequestSchema } from "@/features/attendance/schemas";
import { guestCheckIn, manualCheckIn, scanCardCheckIn } from "@/features/attendance/service";
import { parseInput } from "@/lib/errors";
import { can, requirePermission } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/same-origin";

/**
 * Pointage d'une présence depuis `/admin/scan` : carte scannée (jeton) ou membre choisi dans la
 * liste des inscrits (secours). Ordre : permission, limite de débit, Zod, puis service (qui vérifie
 * le jeton, l'inscription, pointe, encaisse, attribue les points et écrit dans `AuditLog`).
 * Le jeton n'est jamais journalisé.
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePermission("attendance.record");
    assertSameOrigin(request);
    await enforceRateLimit("attendance.scan.user", actor.id);
    const body: unknown = await request.json().catch(() => null);
    const input = parseInput(scanRequestSchema, body);
    const rights = { attendance: true, payments: can(actor, "payments.record") };
    const result =
      input.mode === "token"
        ? await scanCardCheckIn(input, actor.id, rights)
        : input.mode === "guest"
          ? await guestCheckIn(input, actor.id, rights)
          : await manualCheckIn(input, actor.id, rights);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failureResponse(error, "attendance.scan");
  }
}
