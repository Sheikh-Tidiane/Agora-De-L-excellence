import { NextResponse } from "next/server";
import { failureResponse } from "@/features/attendance/http";
import { searchRequestSchema } from "@/features/attendance/schemas";
import { searchRegistrants } from "@/features/attendance/service";
import { parseInput } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/same-origin";

/**
 * Recherche d'un inscrit confirmé à une rencontre (saisie de secours du scan).
 * En POST : le nom cherché ne passe pas dans l'adresse, donc ni dans l'historique ni dans les journaux.
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePermission("attendance.record");
    assertSameOrigin(request);
    await enforceRateLimit("attendance.search.user", actor.id);
    const body: unknown = await request.json().catch(() => null);
    const input = parseInput(searchRequestSchema, body);
    const matches = await searchRegistrants(input.eventId, input.q);
    return NextResponse.json({ ok: true, matches }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failureResponse(error, "attendance.search");
  }
}
