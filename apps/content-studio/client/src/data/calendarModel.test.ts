import { describe, expect, it } from "vitest";
import { hydrateCalendarEntries, moveCalendarEntry, sortCalendarEntries } from "./calendarModel";
import type { GeneratedAsset } from "./strategyData";

const asset = (id: string, sourceDay: number): GeneratedAsset => ({
  id,
  sourceDay,
  segmentId: "S3",
  channel: "telegram",
  type: "post",
  title: `Тема ${id}`,
  content: "Текст материала",
  createdAt: "2026-08-14T00:00:00.000Z",
});

describe("calendarModel", () => {
  it("hydrates entries with a planned status and deterministic order", () => {
    const entries = hydrateCalendarEntries([asset("a", 3)]);
    expect(entries[0]).toMatchObject({ id: "a", sourceDay: 3, status: "planned", order: 3000 });
  });

  it("moves an entry to a target day after existing entries", () => {
    const initial = hydrateCalendarEntries([asset("a", 1), asset("b", 2)]);
    const moved = moveCalendarEntry(initial, "a", 2);
    const sorted = sortCalendarEntries(moved);
    expect(sorted.find((entry) => entry.id === "a")).toMatchObject({ sourceDay: 2, order: 2002 });
    expect(sorted.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("preserves a manually changed status when assets are rehydrated", () => {
    const initial = hydrateCalendarEntries([asset("a", 1)]);
    const ready = initial.map((entry) => ({ ...entry, status: "ready" as const }));
    expect(hydrateCalendarEntries([asset("a", 2)], ready)[0]).toMatchObject({ sourceDay: 2, status: "ready", order: 1000 });
  });
});
