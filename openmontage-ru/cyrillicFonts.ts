/**
 * Local Cyrillic-capable fonts.
 *
 * Replaces the @remotion/google-fonts loaders. Two reasons:
 *  1. Space Grotesk ships no Cyrillic glyphs at all, so Russian text rendered
 *     with it falls back to tofu. Montserrat covers Cyrillic and keeps a
 *     similar geometric-sans feel.
 *  2. The renderer must not depend on fonts.gstatic.com at render time.
 *
 * The faces are embedded as base64 (see cyrillicFontData.ts) rather than
 * fetched from public/. Each render worker loads fonts in its own tab, and
 * parallel fetches against the bundler are slow enough to blow the
 * delayRender timeout on a multi-worker render.
 */
import { continueRender, delayRender } from "remotion";
import { EMBEDDED_FACES } from "./cyrillicFontData";

const base64ToBuffer = (b64: string): ArrayBuffer => {
  const bin = atob(b64);
  const buffer = new ArrayBuffer(bin.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return buffer;
};

let loaded = false;

const loadAll = () => {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  // Every render worker decodes the faces in its own tab. On a multi-worker
  // render those tabs compete for CPU with frame rasterization, and the 28s
  // default is not enough headroom on a small machine.
  const handle = delayRender("Loading local Cyrillic fonts", {
    timeoutInMilliseconds: 120000,
  });
  Promise.all(
    EMBEDDED_FACES.map(async (f) => {
      const face = new FontFace(f.family, base64ToBuffer(f.data), {
        weight: f.weight,
        style: f.style,
      });
      await face.load();
      document.fonts.add(face);
    }),
  )
    // A failed face must not wedge the render — the CSS stack still falls back.
    .catch(() => undefined)
    .then(() => continueRender(handle));
};

loadAll();

/** Geometric sans with Cyrillic. Stands in for Space Grotesk. */
export const displayFamily = '"OM Display", Montserrat, "Noto Sans", system-ui, sans-serif';
/** UI/body sans with Cyrillic. */
export const textFamily = '"OM Text", Inter, "Noto Sans", system-ui, sans-serif';
/** Serif with Cyrillic. Stands in for Playfair Display. */
export const serifFamily = '"OM Serif", "Playfair Display", "Noto Serif", Georgia, serif';
