/** Agrégats du tableau des encaissements. Fonctions pures, testées sans base. */
export type PaymentLine = {
  kind: "MEMBERSHIP_CARD" | "SESSION_FEE";
  amount: number;
  paidAt: Date;
  eventId: string | null;
};

export type MonthTotal = {
  /** Premier jour du mois (UTC = heure de Dakar). */
  month: Date;
  cards: number;
  sessions: number;
  total: number;
  count: number;
};

/** Total encaissé par mois, le plus récent d'abord. Les lignes annulées doivent être exclues en amont. */
export function totalsByMonth(lines: readonly PaymentLine[]): MonthTotal[] {
  const byMonth = new Map<number, MonthTotal>();
  for (const line of lines) {
    const month = new Date(Date.UTC(line.paidAt.getUTCFullYear(), line.paidAt.getUTCMonth(), 1));
    const entry = byMonth.get(month.getTime()) ?? {
      month,
      cards: 0,
      sessions: 0,
      total: 0,
      count: 0,
    };
    if (line.kind === "MEMBERSHIP_CARD") entry.cards += line.amount;
    else entry.sessions += line.amount;
    entry.total += line.amount;
    entry.count += 1;
    byMonth.set(month.getTime(), entry);
  }
  return [...byMonth.values()].sort((a, b) => b.month.getTime() - a.month.getTime());
}

/** Total des participations par séance : identifiant d'événement → montant et nombre de payants. */
export function totalsBySession(
  lines: readonly PaymentLine[],
): Map<string, { total: number; count: number }> {
  const bySession = new Map<string, { total: number; count: number }>();
  for (const line of lines) {
    if (line.kind !== "SESSION_FEE" || !line.eventId) continue;
    const entry = bySession.get(line.eventId) ?? { total: 0, count: 0 };
    entry.total += line.amount;
    entry.count += 1;
    bySession.set(line.eventId, entry);
  }
  return bySession;
}

export function sum(lines: readonly Pick<PaymentLine, "amount">[]): number {
  return lines.reduce((total, line) => total + line.amount, 0);
}
