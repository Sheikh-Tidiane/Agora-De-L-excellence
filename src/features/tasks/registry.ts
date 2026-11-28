import { sendEventReminders } from "@/features/events/reminders";
import { runWaitlistTask } from "@/features/events/waitlist";
import { sendCardReminders } from "@/features/members/card-reminders";
import type { ClubSettings } from "@/features/settings/schemas";
import { loadClubSettings } from "@/features/settings/club";

/**
 * Tâches planifiées du club. Un seul lanceur (scripts/taches.ts), appelé chaque heure par la
 * minuterie deploy/systemd/agora-taches.timer : chaque tâche dit si c'est son heure (`isDue`) et
 * doit pouvoir tourner deux fois sans rien envoyer en double. Ajouter une tâche = l'ajouter ici.
 * Heures de Dakar = UTC (pas d'heure d'été).
 */
export type ScheduledTask = {
  name: string;
  description: string;
  isDue(now: Date, settings: ClubSettings): boolean;
  run(now: Date): Promise<string>;
};

export const tasks: ScheduledTask[] = [
  {
    name: "rappels-carte",
    description:
      "Rappels « carte à régler » (7 jours après l’acceptation, 3 jours avant la fin du délai)",
    // À partir de 9 h ; les passages suivants de la journée ne trouvent plus rien à envoyer.
    isDue: (now) => now.getUTCHours() >= 9,
    run: async (now) => {
      const run = await sendCardReminders(now);
      return `${run.checked} membre(s) avec une carte à régler ; ${run.sent.length} rappel(s) envoyé(s).`;
    },
  },
  {
    name: "rappels-rencontres",
    description: "Rappel par e-mail la veille des rencontres, aux inscrits confirmés",
    // La fenêtre d'envoi (veille à l'heure réglée, jusqu'à 2 h avant) est vérifiée par la tâche.
    isDue: (_now, settings) => settings.eventRemindersEnabled,
    run: async (now) => {
      const run = await sendEventReminders(now);
      return `${run.checked} rappel(s) à envoyer ; ${run.sent} envoyé(s), ${run.failed} en échec, ${run.skipped} déjà pris.`;
    },
  },
  {
    name: "liste-attente",
    description:
      "Liste d’attente : places rendues par les invités qui n’ont pas confirmé, e-mails de place obtenue à renvoyer",
    isDue: () => true,
    run: (now) => runWaitlistTask(now),
  },
];

export type TaskOutcome = { name: string; ok: boolean; summary: string };

/**
 * Lance les tâches dues (ou la seule tâche `only`, même hors de son heure si `force`). Une tâche
 * en échec n'empêche pas les autres ; le lanceur sort alors en erreur.
 */
export async function runDueTasks(
  now: Date = new Date(),
  options: { only?: string; force?: boolean } = {},
): Promise<TaskOutcome[]> {
  const settings = await loadClubSettings();
  const selected = tasks.filter((task) => !options.only || task.name === options.only);
  if (options.only && selected.length === 0) {
    throw new Error(`Tâche inconnue : ${options.only}`);
  }
  const outcomes: TaskOutcome[] = [];
  for (const task of selected) {
    if (!options.force && !task.isDue(now, settings)) continue;
    try {
      outcomes.push({ name: task.name, ok: true, summary: await task.run(now) });
    } catch (error) {
      outcomes.push({
        name: task.name,
        ok: false,
        summary: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return outcomes;
}
