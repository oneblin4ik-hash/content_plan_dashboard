import type { GeneratedAsset } from "./strategyData";

export type CalendarStatus = "planned" | "ready" | "published";

export type CalendarEntry = GeneratedAsset & {
  status: CalendarStatus;
  order: number;
};

export function hydrateCalendarEntries(assets: GeneratedAsset[], previous: CalendarEntry[] = []): CalendarEntry[] {
  return assets.map((asset, index) => {
    const saved = previous.find((entry) => entry.id === asset.id);
    return {
      ...asset,
      status: saved?.status ?? "planned",
      order: saved?.order ?? asset.sourceDay * 1000 + index,
    };
  });
}

export function moveCalendarEntry(entries: CalendarEntry[], assetId: string, targetDay: number): CalendarEntry[] {
  const targetOrder = Math.max(0, ...entries.filter((entry) => entry.sourceDay === targetDay).map((entry) => entry.order)) + 1;
  return entries.map((entry) => entry.id === assetId ? { ...entry, sourceDay: targetDay, order: targetOrder } : entry);
}

export function sortCalendarEntries(entries: CalendarEntry[]): CalendarEntry[] {
  return [...entries].sort((a, b) => a.sourceDay - b.sourceDay || a.order - b.order);
}
