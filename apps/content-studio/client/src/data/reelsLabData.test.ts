import { describe, expect, it } from "vitest";
import { productionChecklist, reelsExamples, reelsMetrics, reelStructure } from "./reelsLabData";

describe("reelsLabData", () => {
  it("contains actionable metric guidance", () => {
    expect(reelsMetrics.length).toBeGreaterThanOrEqual(8);
    expect(reelsMetrics.every((metric) => metric.label && metric.target && metric.action)).toBe(true);
  });

  it("covers all four audience segments with concrete examples", () => {
    expect(reelsExamples.map((example) => example.segment)).toEqual(["S1", "S2", "S3", "S4"]);
    expect(reelsExamples.every((example) => example.hook && example.script && example.cta && example.edit)).toBe(true);
  });

  it("keeps the production system and scenario sequence complete", () => {
    expect(productionChecklist.map((group) => group.title)).toEqual(["Кадр", "Звук", "Титры", "Монтаж", "Описание"]);
    expect(reelStructure.map((step) => step.title)).toEqual(["Стоп-кадр", "Обещание", "Конфликт и доказательство", "Один ответ", "CTA и петля"]);
  });
});
