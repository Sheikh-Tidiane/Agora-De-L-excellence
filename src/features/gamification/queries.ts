import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Lectures de l'administration des points. La page appelante vérifie la permission
 * (`requirePageAccess`) avant d'appeler ces fonctions.
 */
export {
  listMemberTransactions,
  memberPointsTotal,
  type HistoryLine,
} from "@/features/gamification/rewards-service";

export type PointRuleRow = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  points: number;
  eventType: string | null;
  isActive: boolean;
  updatedAt: Date;
};

/** Barème complet : règles de présence (par type d'événement) d'abord, puis les autres. */
export async function listPointRules(): Promise<PointRuleRow[]> {
  return prisma.pointRule.findMany({
    orderBy: [{ eventType: { sort: "asc", nulls: "last" } }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      label: true,
      description: true,
      points: true,
      eventType: true,
      isActive: true,
      updatedAt: true,
    },
  });
}
