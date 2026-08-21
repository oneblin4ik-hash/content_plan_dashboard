import { describe, expect, it, vi } from "vitest";
import { canTriggerHaptic, triggerHaptic } from "./haptics";

describe("triggerHaptic", () => {
  it("silently falls back when the device exposes no vibration API", () => {
    expect(canTriggerHaptic({})).toBe(false);
    expect(triggerHaptic("tap", {})).toBe(false);
  });

  it("sends a compact pattern when vibration is supported", () => {
    const vibrate = vi.fn(() => true);
    expect(triggerHaptic("success", { vibrate })).toBe(true);
    expect(vibrate).toHaveBeenCalledWith([10, 36, 16]);
  });

  it("does not throw when a browser rejects vibration", () => {
    expect(triggerHaptic("navigation", { vibrate: () => { throw new Error("blocked"); } })).toBe(false);
  });
});
