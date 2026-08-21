import { describe, expect, it } from "vitest";
import { priorityLabels, segmentSeed, statusLabels, templateSeed, voiceSeed } from "./contentStudio";

describe("Content Studio seed context", () => {
  it("keeps all four agreed audience segments with unique codes", () => {
    expect(segmentSeed.map(segment => segment.code)).toEqual(["S1", "S2", "S3", "S4"]);
    expect(new Set(segmentSeed.map(segment => segment.code)).size).toBe(4);
    expect(segmentSeed.find(segment => segment.code === "S3")?.offer).toBe("Форма в реальном графике");
  });

  it("keeps the Serbolin voice profile actionable for a content workflow", () => {
    expect(voiceSeed.address).toBe("на ты");
    expect(voiceSeed.structure).toContain("CTA");
    expect(voiceSeed.avoid).toContain("канцелярит");
  });

  it("offers templates for both first-release production formats", () => {
    expect(templateSeed.filter(template => template.kind === "post")).toHaveLength(2);
    expect(templateSeed.filter(template => template.kind === "reel")).toHaveLength(2);
    expect(templateSeed.every(template => template.structure.split("\n").length >= 3)).toBe(true);
  });

  it("keeps labels for every storable content priority and status", () => {
    expect(Object.keys(priorityLabels)).toEqual(["low", "medium", "high", "viral"]);
    expect(Object.keys(statusLabels)).toEqual(["draft", "planned", "ready", "published"]);
  });
});
