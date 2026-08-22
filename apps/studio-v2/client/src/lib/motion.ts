import { useEffect, useRef } from "react";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Drives the ambient glow layers from scroll position and pointer/touch
 * location. Everything is written to `transform` inside a single rAF, so the
 * effect never forces a layout pass while the list is scrolling.
 */
export function useParallaxField(): void {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const layers = Array.from(document.querySelectorAll<HTMLElement>("[data-par]"));
    if (layers.length === 0) return;

    let scrollY = 0;
    let px = 0;
    let py = 0;
    let frame = 0;

    const paint = () => {
      frame = 0;
      for (const layer of layers) {
        const depth = Number.parseFloat(layer.dataset.par ?? "0") || 0;
        const ty = -scrollY * depth + py * depth * 20;
        const tx = px * depth * 38;
        layer.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
      }
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    // The scroller is the app shell, not the window, on this layout.
    const scroller = document.querySelector<HTMLElement>(".scroll");

    const onScroll = () => {
      scrollY = scroller ? scroller.scrollTop : window.scrollY;
      schedule();
    };

    const onPointerMove = (event: PointerEvent) => {
      px = event.clientX / window.innerWidth - 0.5;
      py = event.clientY / window.innerHeight - 0.5;
      schedule();
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      px = touch.clientX / window.innerWidth - 0.5;
      py = touch.clientY / window.innerHeight - 0.5;
      schedule();
    };

    scroller?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    paint();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      scroller?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, []);
}

const MAX_TILT_DEGREES = 7;

/**
 * Gives a card real depth: it rotates toward the finger, then springs back on
 * release instead of snapping. Attach the returned ref to the card element.
 */
export function useTilt<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled || prefersReducedMotion()) return;

    let frame = 0;
    let rx = 0;
    let ry = 0;

    const paint = () => {
      frame = 0;
      node.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    const track = (clientX: number, clientY: number) => {
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const nx = (clientX - rect.left) / rect.width - 0.5;
      const ny = (clientY - rect.top) / rect.height - 0.5;
      ry = nx * MAX_TILT_DEGREES * 1.6;
      rx = -ny * MAX_TILT_DEGREES;
      schedule();
    };

    const engage = () => {
      node.classList.add("pressed");
      node.style.transition = "transform 140ms var(--ease), box-shadow 360ms var(--ease)";
    };

    const release = () => {
      node.classList.remove("pressed");
      node.style.transition =
        "transform 620ms cubic-bezier(.32,1.4,.4,1), box-shadow 360ms var(--ease)";
      rx = 0;
      ry = 0;
      schedule();
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      engage();
      track(touch.clientX, touch.clientY);
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      track(touch.clientX, touch.clientY);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      engage();
      track(event.clientX, event.clientY);
    };

    node.addEventListener("pointermove", onPointerMove, { passive: true });
    node.addEventListener("pointerleave", release);
    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchmove", onTouchMove, { passive: true });
    node.addEventListener("touchend", release, { passive: true });
    node.addEventListener("touchcancel", release, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerleave", release);
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", release);
      node.removeEventListener("touchcancel", release);
    };
  }, [enabled]);

  return ref;
}

export type SwipeDirection = "left" | "right";

/**
 * Horizontal swipes move between sections. Vertical intent and drags that
 * start on a control are ignored so the gesture never fights scrolling.
 */
export function useSwipeNavigation(onSwipe: (direction: SwipeDirection) => void): {
  onTouchStart: (event: React.TouchEvent) => void;
  onTouchEnd: (event: React.TouchEvent) => void;
} {
  const start = useRef<{ x: number; y: number } | null>(null);

  const isInteractive = (target: EventTarget | null) =>
    target instanceof Element &&
    Boolean(target.closest("button, input, textarea, select, a, [data-no-swipe]"));

  return {
    onTouchStart: (event) => {
      if (isInteractive(event.target)) return;
      const touch = event.touches[0];
      if (!touch) return;
      start.current = { x: touch.clientX, y: touch.clientY };
    },
    onTouchEnd: (event) => {
      const origin = start.current;
      start.current = null;
      if (!origin || isInteractive(event.target)) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;
      if (Math.abs(dx) < 70 || Math.abs(dx) <= Math.abs(dy) * 1.35) return;

      onSwipe(dx < 0 ? "left" : "right");
    },
  };
}
