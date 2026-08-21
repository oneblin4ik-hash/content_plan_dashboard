import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({ bootstrapStudio: vi.fn(), getStudioData: vi.fn() }));
const llmMock = vi.hoisted(() => ({ invokeLLM: vi.fn() }));

vi.mock("./db", () => dbMock);
vi.mock("./_core/llm", () => llmMock);

import { viralIdeasRouter } from "./routers/viralIdeas";

const workspace = {
  segments: [{ id: 1, code: "S3", name: "Занятая мама или офис", subtitle: "Реальная неделя без идеального графика", goal: "Выглядеть спортивно при 2–3 тренировках", pain: "Офис, дети и дорога", fear: "Постоянно пропускать", trigger: "План А / Б / В", offer: "Форма в реальном графике", color: "#D95F47" }],
  voice: { id: 1, name: "Serbolin — прямой тренер", tone: "прямой и разговорный", address: "на ты", energy: "энергично", structure: "конфликт → шаг", proof: "кейсы и цифры", cta: "кодовое слово", avoid: "вода", notes: null },
};

const ideas = {
  ideas: [
    { title: "20 минут после работы", hook: "Если у тебя есть 20 минут — это уже не ноль.", format: "POV", angle: "Показать план Б вместо ожидания идеального вечера.", visual: "Таймер и коврик дома", cta: "Сохрани на будний вечер", channel: "reels", objective: "Сохранения" },
    { title: "Офисный обед без хаоса", hook: "Твой обед не обязан выглядеть как Pinterest.", format: "Разбор дня", angle: "Разобрать три рабочих выбора в офисной столовой.", visual: "Ланч-бокс и офисный стол", cta: "Напиши «ОФИС" + "»", channel: "telegram", objective: "Диалог" },
    { title: "Пропуск не ломает неделю", hook: "Один пропуск — не диагноз твоей дисциплины.", format: "План Б", angle: "Дать правило 24 часов для возвращения в ритм.", visual: "Календарь с одной пропущенной отметкой", cta: "Отправь подруге", channel: "reels", objective: "Пересылки" },
  ],
};

function context() { return { user: null, req: { ip: "viral-test" }, res: {} } as never; }

describe("viralIdeas router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.getStudioData.mockResolvedValue(workspace);
    llmMock.invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(ideas) } }] });
  });

  it("generates structured ideas for an anonymous visitor using the selected segment context", async () => {
    const result = await viralIdeasRouter.createCaller(context()).generate({ segmentId: "S3", channel: "both", focus: "питание в офисе", count: 3 });

    expect(result).toEqual(ideas);
    expect(dbMock.bootstrapStudio).toHaveBeenCalledWith(2_000_000_000);
    expect(llmMock.invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5-mini", response_format: expect.objectContaining({ type: "json_schema" }) }));
    expect(llmMock.invokeLLM.mock.calls[0][0].messages[1].content).toContain("Сегмент S3");
    expect(llmMock.invokeLLM.mock.calls[0][0].messages[1].content).toContain("питание в офисе");
  });

  it("accepts the maximum UI selection of eight ideas", async () => {
    await viralIdeasRouter.createCaller(context()).generate({ segmentId: "S3", channel: "both", count: 8 });

    expect(llmMock.invokeLLM.mock.calls[0][0].messages[1].content).toContain("Сгенерируй 8 виральных идей");
  });

  it("rejects an unknown segment before calling the model", async () => {
    await expect(viralIdeasRouter.createCaller(context()).generate({ segmentId: "S9" as never, channel: "reels", count: 3 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(llmMock.invokeLLM).not.toHaveBeenCalled();
  });

  it("rejects generated ideas that contain fabricated social proof", async () => {
    const unsafe = { ideas: ideas.ideas.map((idea, index) => index === 0 ? { ...idea, visual: "Моя клиентка показывает результат до/после" } : idea) };
    llmMock.invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(unsafe) } }] });

    await expect(viralIdeasRouter.createCaller(context()).generate({ segmentId: "S3", channel: "reels", count: 3 })).rejects.toThrow("вымышленный кейс или отзыв");
  });
});
