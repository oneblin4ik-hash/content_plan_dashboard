import { describe, expect, it } from "vitest";
import { defaultVoiceProfile, generateHooks, generatePost, generateReel, makePlan, segments } from "./strategyData";
import { getStudioCalendarMeta, reelsFormulas, studioModes, studioPresets } from "./contentStudioData";
import { buildGeneratorMessages, validateGenerationInput } from "../../../server/contentGenerator";

describe("fitness strategy content data", () => {
  it("keeps a complete 45-day route for every audience segment", () => {
    for (const segment of segments) {
      const plan = makePlan(segment.id);
      expect(plan).toHaveLength(45);
      expect(plan[0]?.day).toBe(1);
      expect(plan[44]?.day).toBe(45);
      expect(plan.every((item) => item.title && item.hook && item.telegram)).toBe(true);
    }
  });

  it("keeps the four audience segments addressable by stable ids", () => {
    expect(segments.map((segment) => segment.id)).toEqual(["S1", "S2", "S3", "S4"]);
  });

  it("generates multiple hooks from a plan topic", () => {
    const hooks = generateHooks("питание в офисный день", defaultVoiceProfile);
    expect(hooks).toHaveLength(6);
    expect(new Set(hooks).size).toBe(6);
    expect(hooks.every((hook) => hook.length > 20)).toBe(true);
  });

  it("generates author-style post and reel scripts with a CTA", () => {
    const post = generatePost("тренировка, когда времени нет", "Занятая мама или офис", defaultVoiceProfile);
    const reel = generateReel("тренировка, когда времени нет", "Занятая мама или офис", defaultVoiceProfile);
    expect(post).toContain("Telegram");
    expect(reel).toContain("ПЕРВЫЕ 2 СЕКУНДЫ");
    expect(reel).toContain("CTA");
  });

  it("keeps the Content Studio modes and presets complete", () => {
    expect(studioModes.map((mode) => mode.id)).toEqual(["reels_topics", "reels_script", "telegram_topics", "telegram_post"]);
    expect(studioPresets.every((preset) => preset.topic.length > 12 && !("mode" in preset) && !("goal" in preset))).toBe(true);
    expect(reelsFormulas).toHaveLength(4);
    expect(getStudioCalendarMeta("reels_script")).toEqual({ channel: "reels", type: "reel" });
    expect(getStudioCalendarMeta("telegram_post")).toEqual({ channel: "telegram", type: "post" });
    expect(getStudioCalendarMeta("telegram_topics")).toEqual({ channel: "telegram", type: "hook" });
  });

  it("guides Reels and Telegram generation toward story structure and natural author language", () => {
    const messages = buildGeneratorMessages({
      mode: "reels_script", topic: "тренировка после работы", goal: "охват и сохранения", strategyGoal: "получить заявки на бесплатный разбор", length: "medium",
      segment: { id: "S3", name: "Занятая мама или офис", pain: "нет времени", fear: "сорваться", trigger: "план Б" },
      voice: { name: "Serbolin", tone: "прямой", address: "на ты", energy: "энергично", structure: "конфликт → ответ", proof: "процесс", cta: "сохрани", avoid: "канцелярит", notes: "короткие фразы" },
      formula: "Ситуация → конфликт → ответ", structure: "контекст → вывод", cta: "сохрани",
    });
    expect(messages.system).toContain("конкретную ситуацию");
    expect(messages.system).toContain("не выдумывай");
    expect(messages.system).toContain("живого русского текста");
    expect(messages.user).toContain("мини-историю");
    expect(messages.user).toContain("получить заявки на бесплатный разбор");
  });

  it("supports a strategy-goal checklist without changing Studio material modes", () => {
    const input = validateGenerationInput({ mode: "strategy_checklist", topic: "получить 10 заявок", goal: "план действий", strategyGoal: "получить 10 заявок через Reels и Telegram", length: "medium", segment: segments[2], voice: defaultVoiceProfile });
    const messages = buildGeneratorMessages(input);
    expect(input.mode).toBe("strategy_checklist");
    expect(messages.user).toContain("получить 10 заявок через Reels и Telegram");
    expect(messages.user).toContain("ровно 7 пунктов");
  });

  it("supports one weekly package with Reels and Telegram materials", () => {
    const input = validateGenerationInput({ mode: "weekly_content_pack", topic: "неделя контента для заявок", goal: "получить заявки на бесплатный разбор", strategyGoal: "привлечь женщин S3 на бесплатный разбор", length: "medium", segment: segments[2], voice: defaultVoiceProfile });
    const messages = buildGeneratorMessages(input);
    expect(input.mode).toBe("weekly_content_pack");
    expect(messages.user).toContain("weekly.reelsTopic");
    expect(messages.user).toContain("weekly.telegramPost");
    expect(messages.user).toContain("привлечь женщин S3 на бесплатный разбор");
  });
});
