export type HapticFeedback = "tap" | "navigation" | "success" | "warning";

type HapticNavigator = {
  vibrate?: (pattern: number | number[]) => boolean;
};

const patterns: Record<HapticFeedback, number | number[]> = {
  tap: 8,
  navigation: 12,
  success: [10, 36, 16],
  warning: [18, 60, 18],
};

export function canTriggerHaptic(target?: HapticNavigator): boolean {
  const device = target ?? (typeof navigator === "undefined" ? undefined : navigator);
  return typeof device?.vibrate === "function";
}

/**
 * Progressively enhances user-initiated interactions where the browser exposes
 * the Vibration API. Safari/WebKit does not expose it to web pages; there this
 * returns false and the caller's visual press state is the acknowledgement.
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

const PRESS_MS = 160;

/**
 * Installs the global press handler: a real buzz where the platform allows it,
 * a short scale-down everywhere else. Returns a teardown for the caller.
 */
export function installHaptics(root: Document | HTMLElement = document): () => void {
  const onPointerDown = (event: Event) => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(
            "button:not(:disabled), [role='button'], a[href], .tappable",
          )
        : null;
    if (!target || target.hasAttribute("data-no-haptic")) return;

    if (!canTriggerHaptic()) {
      target.dataset.hapticPressed = "true";
      window.setTimeout(() => {
        delete target.dataset.hapticPressed;
      }, PRESS_MS);
    }
    triggerHaptic("tap");
  };

  root.addEventListener("pointerdown", onPointerDown, { passive: true });
  return () => root.removeEventListener("pointerdown", onPointerDown);
}
