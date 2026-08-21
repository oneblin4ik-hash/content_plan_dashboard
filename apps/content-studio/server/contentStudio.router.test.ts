import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  bootstrapStudio: vi.fn(),
  getStudioData: vi.fn(),
  createContentItem: vi.fn(),
  updateContentItem: vi.fn(),
  deleteContentItem: vi.fn(),
  createMetric: vi.fn(),
  createFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn(),
}));

vi.mock("./db", () => dbMock);

import { contentStudioRouter } from "./routers/contentStudio";

function context(role: "admin" | "user" | null) {
  return {
    user: role ? { id: 42, role } : null,
    req: {} as never,
    res: {} as never,
  };
}

describe("contentStudio router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.getStudioData.mockResolvedValue({ folders: [], items: [], templates: [], voice: null, segments: [], metrics: [], settings: null });
    dbMock.createContentItem.mockResolvedValue({ id: 1 });
    dbMock.createMetric.mockResolvedValue({ id: 2 });
  });

  it("allows bootstrap only for the project owner and initializes their personal workspace", async () => {
    const workspace = { folders: [{ id: 1, name: "Кейсы" }], items: [], templates: [], voice: null, segments: [], metrics: [], settings: null };
    dbMock.getStudioData.mockResolvedValue(workspace);
    const caller = contentStudioRouter.createCaller(context("admin") as never);
    const result = await caller.bootstrap();

    expect(dbMock.bootstrapStudio).toHaveBeenCalledWith(42);
    expect(dbMock.getStudioData).toHaveBeenCalledWith(42);
    expect(result).toEqual(workspace);
  });

  it("rejects anonymous and non-owner callers", async () => {
    await expect(contentStudioRouter.createCaller(context(null) as never).bootstrap()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(contentStudioRouter.createCaller(context("user") as never).bootstrap()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates a personal idea with its audience context", async () => {
    const caller = contentStudioRouter.createCaller(context("admin") as never);
    await caller.item.create({ kind: "idea", channel: "reels", status: "draft", priority: "high", folderId: null, title: "План Б для занятой мамы", hook: "Не нужен идеальный понедельник", body: null, format: "POV", visual: null, cta: null, notes: null, segmentId: "S3", scheduledFor: null, isFavorite: false });

    expect(dbMock.createContentItem).toHaveBeenCalledWith(42, expect.objectContaining({ kind: "idea", channel: "reels", segmentId: "S3", title: "План Б для занятой мамы" }));
  });

  it("records planned publication dates through the item update flow", async () => {
    const caller = contentStudioRouter.createCaller(context("admin") as never);
    const scheduledFor = new Date("2026-08-24T12:00:00.000Z");
    await caller.item.update({ id: 7, data: { status: "planned", scheduledFor } });

    expect(dbMock.updateContentItem).toHaveBeenCalledWith(42, 7, { status: "planned", scheduledFor });
  });

  it("creates and removes folders only inside the owner workspace", async () => {
    dbMock.createFolder.mockResolvedValue({ id: 5, name: "Кейсы" });
    const caller = contentStudioRouter.createCaller(context("admin") as never);
    await caller.folder.create({ name: "Кейсы", color: "#D84444" });
    await caller.folder.delete({ id: 5 });

    expect(dbMock.createFolder).toHaveBeenCalledWith(42, { name: "Кейсы", color: "#D84444" });
    expect(dbMock.deleteFolder).toHaveBeenCalledWith(42, 5);
  });

  it("updates a folder inside the owner workspace", async () => {
    const caller = contentStudioRouter.createCaller(context("admin") as never);
    await caller.folder.update({ id: 5, data: { name: "Кейсы клиентов", color: "#A9353D", sortOrder: 2 } });

    expect(dbMock.updateFolder).toHaveBeenCalledWith(42, 5, { name: "Кейсы клиентов", color: "#A9353D", sortOrder: 2 });
  });

  it("removes a material only from the current owner workspace", async () => {
    const caller = contentStudioRouter.createCaller(context("admin") as never);
    await caller.item.delete({ id: 7 });

    expect(dbMock.deleteContentItem).toHaveBeenCalledWith(42, 7);
  });

  it("edits a material without applying unwanted default field values", async () => {
    const caller = contentStudioRouter.createCaller(context("admin") as never);
    await caller.item.update({ id: 7, data: { title: "Обновлённый хук", hook: "Новая первая фраза" } });

    expect(dbMock.updateContentItem).toHaveBeenCalledWith(42, 7, { title: "Обновлённый хук", hook: "Новая первая фраза" });
  });

  it("stores manually recorded publication metrics for the owner", async () => {
    const caller = contentStudioRouter.createCaller(context("admin") as never);
    await caller.metric.create({ itemId: 7, views: 1200, reactions: 74, comments: 4, saves: 33, shares: 15, linkClicks: 9, leads: 3 });

    expect(dbMock.createMetric).toHaveBeenCalledWith(42, expect.objectContaining({ itemId: 7, views: 1200, saves: 33, leads: 3 }));
  });
});
