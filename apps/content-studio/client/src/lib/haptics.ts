export type HapticFeedback = "tap" | "navigation" | "success";

type HapticNavigator = {
  vibrate?: (pattern: number | number[]) => boolean;
};

const patterns: Record<HapticFeedback, number | number[]> = {
  tap: 8,
  navigation: 12,
  success: [10, 36, 16],
};

export function canTriggerHaptic(target?: HapticNavigator): boolean {
  const device = target ?? (typeof navigator === "undefined" ? undefined : navigator);
  return typeof device?.vibrate === "function";
}

/**
 * Progressively enhances user-initiated interactions where the browser exposes
 * the Vibration API. Safari/WebKit may not expose that public API; in that case
 * this returns false and the touch-specific CSS :active feedback remains the
 * immediate, non-blocking acknowledgement.
 */
export function triggerHaptic(feedback: HapticFeedback, target?: HapticNavigator): boolean {
  const device = target ?? (typeof navigator === "undefined" ? undefined : navigator);
  if (!canTriggerHaptic(device)) return false;
  const vibrate = device?.vibrate;
  if (typeof vibrate !== "function") return false;
  try {
    return vibrate.call(device, patterns[feedback]);
  } catch {
    return false;
  }
}
