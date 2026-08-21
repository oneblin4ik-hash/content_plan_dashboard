import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  bootstrapStudio: vi.fn(), getStudioData: vi.fn(), createContentItem: vi.fn(), updateContentItem: vi.fn(), deleteContentItem: vi.fn(),
  createMetric: vi.fn(), createFolder: vi.fn(), updateFolder: vi.fn(), deleteFolder: vi.fn(),
}));
vi.mock("./db", () => dbMock);

import { contentStudioRouter, PUBLIC_STUDIO_OWNER_ID } from "./routers/contentStudio";

function context(role: "admin" | "user" | null) { return { user: role ? { id: 42, role } : null, req: {} as never, res: {} as never }; }

describe("public contentStudio router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.getStudioData.mockResolvedValue({ folders: [], items: [], templates: [], voice: null, segments: [], metrics: [], settings: null });
    dbMock.createContentItem.mockResolvedValue({ id: 1 });
    dbMock.createMetric.mockResolvedValue({ id: 2 });
  });

  it("opens and returns one shared workspace to an anonymous visitor", async () => {
    const workspace = { folders: [{ id: 1, name: "Кейсы" }], items: [], templates: [], voice: null, segments: [], metrics: [], settings: null };
    dbMock.getStudioData.mockResolvedValue(workspace);
    const result = await contentStudioRouter.createCaller(context(null) as never).bootstrap();

    expect(dbMock.bootstrapStudio).toHaveBeenCalledWith(PUBLIC_STUDIO_OWNER_ID);
    expect(dbMock.getStudioData).toHaveBeenCalledWith(PUBLIC_STUDIO_OWNER_ID);
    expect(result).toEqual(workspace);
  });

  it("uses the same workspace whether a visitor is anonymous or signed in", async () => {
    await contentStudioRouter.createCaller(context(null) as never).bootstrap();
    await contentStudioRouter.createCaller(context("user") as never).bootstrap();

    expect(dbMock.bootstrapStudio).toHaveBeenNthCalledWith(1, PUBLIC_STUDIO_OWNER_ID);
    expect(dbMock.bootstrapStudio).toHaveBeenNthCalledWith(2, PUBLIC_STUDIO_OWNER_ID);
  });

  it("creates an idea without login and keeps its audience context", async () => {
    const caller = contentStudioRouter.createCaller(context(null) as never);
    await caller.item.create({ kind: "idea", channel: "reels", status: "draft", priority: "high", folderId: null, title: "План Б для занятой мамы", hook: "Не нужен идеальный понедельник", body: null, format: "POV", visual: null, cta: null, notes: null, segmentId: "S3", scheduledFor: null, isFavorite: false });

    expect(dbMock.createContentItem).toHaveBeenCalledWith(PUBLIC_STUDIO_OWNER_ID, expect.objectContaining({ kind: "idea", channel: "reels", segmentId: "S3", title: "План Б для занятой мамы" }));
  });

  it("updates a planned publication without applying unwanted defaults", async () => {
    const caller = contentStudioRouter.createCaller(context(null) as never);
    const scheduledFor = new Date("2026-08-24T12:00:00.000Z");
    await caller.item.update({ id: 7, data: { status: "planned", scheduledFor } });

    expect(dbMock.updateContentItem).toHaveBeenCalledWith(PUBLIC_STUDIO_OWNER_ID, 7, { status: "planned", scheduledFor });
  });

  it("edits and deletes materials in the shared workspace", async () => {
    const caller = contentStudioRouter.createCaller(context(null) as never);
    await caller.item.update({ id: 7, data: { title: "Обновлённый хук", hook: "Новая первая фраза" } });
    await caller.item.delete({ id: 7 });

    expect(dbMock.updateContentItem).toHaveBeenCalledWith(PUBLIC_STUDIO_OWNER_ID, 7, { title: "Обновлённый хук", hook: "Новая первая фраза" });
    expect(dbMock.deleteContentItem).toHaveBeenCalledWith(PUBLIC_STUDIO_OWNER_ID, 7);
  });

  it("creates, updates and deletes folders in the shared workspace", async () => {
    dbMock.createFolder.mockResolvedValue({ id: 5, name: "Кейсы" });
    const caller = contentStudioRouter.createCaller(context(null) as never);
    await caller.folder.create({ name: "Кейсы", color: "#D84444" });
    await caller.folder.update({ id: 5, data: { name: "Кейсы клиентов", color: "#A9353D", sortOrder: 2 } });
    await caller.folder.delete({ id: 5 });

    expect(dbMock.createFolder).toHaveBeenCalledWith(PUBLIC_STUDIO_OWNER_ID, { name: "Кейсы", color: "#D84444" });
    expect(dbMock.updateFolder).toHaveBeenCalledWith(PUBLIC_STUDIO_OWNER_ID, 5, { name: "Кейсы клиентов", color: "#A9353D", sortOrder: 2 });
    expect(dbMock.deleteFolder).toHaveBeenCalledWith(PUBLIC_STUDIO_OWNER_ID, 5);
  });

  it("stores publication metrics without login", async () => {
    const caller = contentStudioRouter.createCaller(context(null) as never);
    await caller.metric.create({ itemId: 7, views: 1200, reactions: 74, comments: 4, saves: 33, shares: 15, linkClicks: 9, leads: 3 });

    expect(dbMock.createMetric).toHaveBeenCalledWith(PUBLIC_STUDIO_OWNER_ID, expect.objectContaining({ itemId: 7, views: 1200, saves: 33, leads: 3 }));
  });
});
