import { NextResponse } from "next/server";
import { toFailure } from "@/lib/errors";

/** Réponse JSON d'une erreur de Route Handler, avec le statut HTTP de son code. */
const statusByCode: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 422,
  RATE_LIMITED: 429,
};

export function failureResponse(error: unknown, context: string): NextResponse {
  const failure = toFailure(error, context);
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (failure.retryAfter) headers["Retry-After"] = String(failure.retryAfter);
  return NextResponse.json(failure, { status: statusByCode[failure.code] ?? 500, headers });
}
