/**
 * Hybrid storage layer for Content Studio.
 *
 * When the server reports `sync.status.enabled = true` (i.e. Cloudflare D1 is
 * configured), data flows through tRPC `sync.*` procedures. When it's false,
 * we fall back to localStorage with the same shape so the UI never breaks
 * regardless of deployment state.
 */

export type Mode = "pack" | "post" | "reels" | "hooks" | "hashtags" | "carousel";

export type LibraryItem = {
  id: string;
  createdAt: number;
  title: string;
  mode: Mode;
  platform?: string | null;
  payload: Record<string, unknown>;
};

export type ScheduledItem = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  format?: string | null;
  topicId?: number | null;
};

const LIB_KEY = "serbolin.studio.library.v1";
const SCH_KEY = "serbolin.studio.calendar.v1";

export const localLibrary = {
  load(): LibraryItem[] {
    try {
      return JSON.parse(localStorage.getItem(LIB_KEY) || "[]");
    } catch {
      return [];
    }
  },
  save(items: LibraryItem[]) {
    localStorage.setItem(LIB_KEY, JSON.stringify(items));
  },
  add(item: LibraryItem) {
    const items = this.load();
    items.unshift(item);
    this.save(items);
  },
  remove(id: string) {
    this.save(this.load().filter((i) => i.id !== id));
  },
  clear() {
    this.save([]);
  },
};

export const localCalendar = {
  load(): ScheduledItem[] {
    try {
      return JSON.parse(localStorage.getItem(SCH_KEY) || "[]");
    } catch {
      return [];
    }
  },
  save(items: ScheduledItem[]) {
    localStorage.setItem(SCH_KEY, JSON.stringify(items));
  },
  add(item: ScheduledItem) {
    const items = this.load();
    items.push(item);
    this.save(items);
  },
  remove(id: string) {
    this.save(this.load().filter((i) => i.id !== id));
  },
  update(id: string, patch: Partial<ScheduledItem>) {
    this.save(
      this.load().map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  },
};
