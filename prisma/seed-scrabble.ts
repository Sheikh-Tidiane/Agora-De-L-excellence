import { computeRanking } from "@/features/scrabble/ranking";
import { prisma } from "@/lib/prisma";

/**
 * Résultats du tournoi de démonstration (`isDemo`), pour que les pages Scrabble aient quelque chose
 * à montrer : six participants extérieurs (le seed ne crée aucun compte de membre), trois manches
 * de duplicate, un forfait, une égalité à la 4e place, résultats validés et publiés, un record.
 * Idempotent : rien n'est réécrit si le tournoi a déjà des joueurs ou des résultats validés, ni si
 * ce n'est pas un tournoi de démonstration. Aucun point n'est attribué (aucun membre).
 */
const players: { name: string; scores: (number | "forfait")[] }[] = [
  { name: "Aminata Sow", scores: [812, 790, 845] },
  { name: "Cheikh Diallo", scores: [798, 805, 820] },
  { name: "Khady Ndiaye", scores: [760, 812, 801] },
  { name: "Ousmane Faye", scores: [744, 770, 790] },
  { name: "Babacar Mbaye", scores: [750, 764, 790] },
  { name: "Ndèye Guèye", scores: [701, "forfait", 735] },
];

export async function seedDemoTournamentResults(slug: string): Promise<void> {
  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: {
      id: true,
      isDemo: true,
      startsAt: true,
      resultsValidatedAt: true,
      _count: { select: { participants: true } },
    },
  });
  if (!tournament?.isDemo || tournament.resultsValidatedAt || tournament._count.participants > 0)
    return;

  await prisma.$transaction(async (tx) => {
    const created = [];
    for (const player of players) {
      created.push(
        await tx.tournamentParticipant.create({
          data: {
            tournamentId: tournament.id,
            externalName: player.name,
            externalClub: "Club invité",
          },
          select: { id: true },
        }),
      );
    }
    const scores = [];
    for (let number = 1; number <= 3; number++) {
      const round = await tx.round.create({
        data: { tournamentId: tournament.id, number, status: "COMPLETED" },
        select: { id: true },
      });
      for (const [index, player] of players.entries()) {
        const value = player.scores[number - 1];
        const row = {
          roundId: round.id,
          participantId: created[index].id,
          points: value === "forfait" ? 0 : value,
          isForfeit: value === "forfait",
        };
        await tx.score.create({ data: row });
        scores.push(row);
      }
    }
    const ranking = computeRanking(
      {
        rule: "CUMULATIVE_SCORE",
        classic: false,
        matches: [],
        participants: created.map((p) => ({ id: p.id, teamId: null, withdrawn: false })),
        scores,
      },
      { teams: false },
    );
    for (const standing of ranking.standings) {
      await tx.tournamentParticipant.update({
        where: { id: standing.participantId },
        data: { finalRank: standing.rank },
      });
    }
    const validatedAt = new Date(tournament.startsAt.getTime() + 3 * 60 * 60 * 1000);
    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        status: "COMPLETED",
        format: "INDIVIDUAL",
        gameMode: "DUPLICATE",
        rankingRule: "CUMULATIVE_SCORE",
        resultsValidatedAt: validatedAt,
        resultsPublishedAt: validatedAt,
      },
    });
    await tx.scrabbleRecord.create({
      data: {
        category: "Meilleur score sur une partie",
        value: "845 points",
        holderName: players[0].name,
        tournamentId: tournament.id,
        achievedAt: tournament.startsAt,
        isDemo: true,
      },
    });
  });
}
