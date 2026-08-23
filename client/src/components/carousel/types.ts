/**
 * Общие типы, константы и утилиты конструктора каруселей.
 * Вынесены из pages/Carousel.tsx, чтобы монолит не разрастался:
 * SlideCanvas и будущие панели импортируют отсюда.
 */

export type SlideKind = "cover" | "content" | "cta";
/* Layout контент-слайда (этап 5):
   - default: headline + body (как было)
   - quote: крупная цитата с декоративными кавычками, body = подпись
   - list: headline + маркированный список (body построчно)
   - bignumber: огромная цифра/факт (headline) + подпись (body) */
export type SlideLayout = "default" | "quote" | "list" | "bignumber";
export type Slide = {
  id: string;
  kind: SlideKind;
  layout?: SlideLayout;
  headline: string;
  body: string;
  /* Фоновое фото. Храним dataURL (data:image/...;base64,...) —
     это снимает CORS-проблемы при экспорте через html-to-image и
     гарантирует, что превью и экспорт идентичны. Файлы конвертим
     через FileReader, внешние URL — через fetch+FileReader. */
  imageUrl?: string;
  /* Затемнение фото 0..1 (для читаемости текста на ярких фото). */
  overlay?: number;
};

export type Theme = {
  id: string;
  name: string;
  bg: string;
  text: string;
  body: string;
  accent: string;
  accentText: string;
  fontHead: string;
  fontBody: string;
};

export const FONT_DISPLAY =
  '"Space Grotesk", "Inter", -apple-system, sans-serif';
export const FONT_BODY = '"Inter", -apple-system, sans-serif';

/* Наборы шрифтов для слайдов (head — заголовки, body — текст).
   Подобраны под формат IG-каруселей: жирные геометрические и
   конденсированные начертания, которые хорошо читаются на телефоне.
   Все подгружены через @import в index.css. */
export type FontPreset = {
  id: string;
  name: string;
  head: string;
  body: string;
  /* Жирность заголовка — у разных шрифтов «тяжёлый» вес отличается. */
  headWeight: number;
};
export const FONTS: FontPreset[] = [
  {
    id: "grotesk",
    name: "Space Grotesk",
    head: FONT_DISPLAY,
    body: FONT_BODY,
    headWeight: 700,
  },
  {
    id: "montserrat",
    name: "Montserrat",
    head: '"Montserrat", sans-serif',
    body: '"Montserrat", sans-serif',
    headWeight: 800,
  },
  {
    id: "poppins",
    name: "Poppins",
    head: '"Poppins", sans-serif',
    body: '"Poppins", sans-serif',
    headWeight: 700,
  },
  {
    id: "oswald",
    name: "Oswald",
    head: '"Oswald", sans-serif',
    body: '"Inter", sans-serif',
    headWeight: 700,
  },
  {
    id: "bebas",
    name: "Bebas Neue",
    head: '"Bebas Neue", sans-serif',
    body: '"Inter", sans-serif',
    headWeight: 400,
  },
  {
    id: "unbounded",
    name: "Unbounded",
    head: '"Unbounded", sans-serif',
    body: '"Inter", sans-serif',
    headWeight: 700,
  },
  {
    id: "manrope",
    name: "Manrope",
    head: '"Manrope", sans-serif',
    body: '"Manrope", sans-serif',
    headWeight: 800,
  },
];

export type Align = "left" | "center" | "right";

export const THEMES: Theme[] = [
  {
    id: "ink_gold",
    name: "Тёмная · золото",
    bg: "#1a1a1a",
    text: "#ffffff",
    body: "rgba(255,255,255,0.78)",
    accent: "#d4a843",
    accentText: "#1a1a1a",
    fontHead: FONT_DISPLAY,
    fontBody: FONT_BODY,
  },
  {
    id: "cream",
    name: "Светлая · крем",
    bg: "#f4efe6",
    text: "#1a1a1a",
    body: "rgba(26,26,26,0.72)",
    accent: "#c08a2d",
    accentText: "#ffffff",
    fontHead: FONT_DISPLAY,
    fontBody: FONT_BODY,
  },
  {
    id: "gold_grad",
    name: "Градиент · золото",
    bg: "linear-gradient(150deg, #2a2410 0%, #1a1a1a 55%, #0d0d0d 100%)",
    text: "#f6e7c2",
    body: "rgba(246,231,194,0.8)",
    accent: "#d4a843",
    accentText: "#1a1a1a",
    fontHead: FONT_DISPLAY,
    fontBody: FONT_BODY,
  },
  {
    id: "violet",
    name: "Градиент · виолет",
    bg: "linear-gradient(160deg, #6d28d9 0%, #4c1d95 50%, #2e1065 100%)",
    text: "#ffffff",
    body: "rgba(255,255,255,0.82)",
    accent: "#f0abfc",
    accentText: "#2e1065",
    fontHead: FONT_DISPLAY,
    fontBody: FONT_BODY,
  },
  {
    id: "ocean",
    name: "Градиент · океан",
    bg: "linear-gradient(160deg, #0ea5e9 0%, #0369a1 55%, #082f49 100%)",
    text: "#ffffff",
    body: "rgba(255,255,255,0.82)",
    accent: "#7dd3fc",
    accentText: "#082f49",
    fontHead: FONT_DISPLAY,
    fontBody: FONT_BODY,
  },
  {
    id: "mono",
    name: "Чёрный · моно",
    bg: "#0a0a0a",
    text: "#ffffff",
    body: "rgba(255,255,255,0.7)",
    accent: "#ffffff",
    accentText: "#0a0a0a",
    fontHead: FONT_DISPLAY,
    fontBody: FONT_BODY,
  },
];

export type Ratio = "4:5" | "1:1" | "9:16";
export const RATIO_DIMS: Record<Ratio, { w: number; h: number }> = {
  "4:5": { w: 1080, h: 1350 },
  "1:1": { w: 1080, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
};

export const ACCENT_SWATCHES = [
  "#d4a843",
  "#f0abfc",
  "#7dd3fc",
  "#34d399",
  "#fb7185",
  "#ffffff",
];

export const uid = () => Math.random().toString(36).slice(2, 10);

/* Лимит на фото — чтобы payload карусели не раздулся в D1 и не вылетел
   за лимит строки (1 MB). 4 MB исходника после base64 ≈ 5.3 MB; для
   обложки этого с запасом, а тяжёлые DSLR-снимки не нужны. */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const ALLOWED_MIME = /^image\/(jpeg|jpg|png|webp)$/i;

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Не удалось прочитать файл"));
    r.readAsDataURL(file);
  });
}

/* Берём чужую картинку и конвертим в dataURL: иначе html-to-image
   получает tainted canvas (CORS) и экспорт PNG падает. Если fetch
   не пройдёт (CORS / 404) — возвращаем исходный URL, превью покажет,
   но при экспорте может ругнуться. */
export async function urlToDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (!ALLOWED_MIME.test(blob.type)) {
      throw new Error(`Не картинка: ${blob.type || "unknown"}`);
    }
    if (blob.size > MAX_PHOTO_BYTES) {
      throw new Error(`Файл больше 4 MB`);
    }
    const file = new File([blob], "remote", { type: blob.type });
    return await fileToDataUrl(file);
  } catch {
    return url;
  }
}
