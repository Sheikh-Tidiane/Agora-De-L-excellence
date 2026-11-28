import { describe, expect, it } from "vitest";
import { tasks } from "@/features/tasks/registry";
import { defaultClubSettings } from "@/features/settings/schemas";

const task = (name: string) => tasks.find((t) => t.name === name)!;

describe("tâches planifiées", () => {
  it("chaque tâche a un nom unique", () => {
    expect(new Set(tasks.map((t) => t.name)).size).toBe(tasks.length);
  });

  it("rappels de carte à partir de 9 h ; rappels de rencontre seulement si le réglage est actif", () => {
    expect(task("rappels-carte").isDue(new Date("2026-12-04T08:05:00Z"), defaultClubSettings)).toBe(
      false,
    );
    expect(task("rappels-carte").isDue(new Date("2026-12-04T09:05:00Z"), defaultClubSettings)).toBe(
      true,
    );
    const now = new Date("2026-12-04T10:05:00Z");
    expect(task("rappels-rencontres").isDue(now, defaultClubSettings)).toBe(true);
    expect(
      task("rappels-rencontres").isDue(now, {
        ...defaultClubSettings,
        eventRemindersEnabled: false,
      }),
    ).toBe(false);
  });
});
