import type { Slide, SlideLayout, Theme, Align, Ratio } from "./types";
import { RATIO_DIMS } from "./types";

/* ============================================================
   SlideCanvas — рендерит один слайд. Все размеры выражены через
   `width`, поэтому превью (420px) и экспорт (1080px) выглядят
   идентично — пропорциональное масштабирование.
   ============================================================ */
export default function SlideCanvas({
  slide,
  index,
  total,
  theme,
  handle,
  showPages,
  showHandle,
  width,
  ratio,
  align = "left",
  headWeight = 700,
  authorName = "",
  avatarUrl,
  showSwipeHint = false,
  swipeText = "Листай",
  ctaText = "",
}: {
  slide: Slide;
  index: number;
  total: number;
  theme: Theme;
  handle: string;
  showPages: boolean;
  showHandle: boolean;
  width: number;
  ratio: Ratio;
  align?: Align;
  headWeight?: number;
  /* Брендинг-плашка: имя автора + круглый аватар (dataURL). */
  authorName?: string;
  avatarUrl?: string;
  /* Swipe-хинт на обложке. */
  showSwipeHint?: boolean;
  swipeText?: string;
  /* Текст CTA-кнопки последнего слайда; пусто → fallback на handle. */
  ctaText?: string;
}) {
  const dims = RATIO_DIMS[ratio];
  const height = (width * dims.h) / dims.w;
  const u = width / 1080; // unit scale relative to full size
  const pad = 92 * u;
  const isCover = slide.kind === "cover";
  const isCta = slide.kind === "cta";
  const layout: SlideLayout = slide.layout ?? "default";

  const headSize = (isCover ? 92 : 64) * u;
  const bodySize = (isCover ? 34 : 30) * u;
  const kickerSize = 22 * u;

  const overlayAlpha = slide.imageUrl ? (slide.overlay ?? 0.4) : 0;

  /* Выравнивание текста: влияет на textAlign контента и на сторону,
     к которой прижаты блоки (полоса обложки, CTA-кнопка, футер). */
  const alignItems =
    align === "center"
      ? "center"
      : align === "right"
        ? "flex-end"
        : "flex-start";
  const footerSide =
    align === "center"
      ? { left: 0, right: 0, textAlign: "center" as const }
      : align === "right"
        ? { right: pad, textAlign: "right" as const }
        : { left: pad, textAlign: "left" as const };

  return (
    <div
      style={{
        width,
        height,
        background: theme.bg,
        color: theme.text,
        borderRadius: 14 * u,
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: isCover ? "center" : "flex-start",
        padding: pad,
        boxSizing: "border-box",
        fontFamily: theme.fontBody,
      }}
    >
      {/* Фоновое фото + затемнение под текст. crossOrigin="anonymous"
          + decoding="sync" — на dataURL не влияет, но не вредит, если
          вдруг пришёл внешний URL. */}
      {slide.imageUrl && (
        <>
          <img
            src={slide.imageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 0,
            }}
          />
          {overlayAlpha > 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(180deg, rgba(0,0,0,${overlayAlpha * 0.7}) 0%, rgba(0,0,0,${overlayAlpha}) 100%)`,
                zIndex: 1,
              }}
            />
          )}
          {/* Поверх — невидимый слой, чтобы контент рендерился над фото. */}
        </>
      )}

      {/* Верхний kicker */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: isCover ? "absolute" : "relative",
          top: isCover ? pad : undefined,
          left: isCover ? pad : undefined,
          right: isCover ? pad : undefined,
          marginBottom: isCover ? 0 : 40 * u,
          zIndex: 2,
        }}
      >
        <span
          style={{
            fontFamily: theme.fontHead,
            fontSize: kickerSize,
            fontWeight: 700,
            letterSpacing: 2 * u,
            textTransform: "uppercase",
            color: theme.accent,
          }}
        >
          {isCover ? "Карусель" : isCta ? "Действие" : "Разбор"}
        </span>
        {showPages && (
          <span
            style={{
              fontFamily: theme.fontHead,
              fontSize: kickerSize,
              fontWeight: 700,
              color: theme.body,
            }}
          >
            {String(index + 1).padStart(2, "0")}/
            {String(total).padStart(2, "0")}
          </span>
        )}
      </div>

      {/* Контент */}
      <div
        style={{
          flex: isCover ? "none" : 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: isCover ? "center" : "flex-start",
          alignItems,
          textAlign: align,
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Акцентная полоса у обложки */}
        {isCover && (
          <div
            style={{
              width: 80 * u,
              height: 8 * u,
              background: theme.accent,
              borderRadius: 9999,
              marginBottom: 36 * u,
            }}
          />
        )}
        {/* Layout-варианты (этап 5). Quote/list/bignumber применимы к
            content-слайдам; cover и cta всегда рендерятся дефолтно. */}
        {layout === "quote" && !isCover && !isCta ? (
          <>
            <div
              style={{
                fontFamily: theme.fontHead,
                fontSize: 140 * u,
                fontWeight: 700,
                lineHeight: 0.6,
                color: theme.accent,
                marginBottom: 8 * u,
              }}
            >
              “
            </div>
            <div
              style={{
                fontFamily: theme.fontHead,
                fontSize: 58 * u,
                fontWeight: headWeight,
                lineHeight: 1.15,
                fontStyle: "italic",
                whiteSpace: "pre-wrap",
              }}
            >
              {slide.headline}
            </div>
            {slide.body && (
              <div
                style={{
                  fontSize: 26 * u,
                  color: theme.body,
                  marginTop: 30 * u,
                }}
              >
                — {slide.body}
              </div>
            )}
          </>
        ) : layout === "bignumber" && !isCover && !isCta ? (
          <>
            <div
              style={{
                fontFamily: theme.fontHead,
                fontSize: 200 * u,
                fontWeight: 800,
                lineHeight: 1,
                color: theme.accent,
                letterSpacing: -4 * u,
              }}
            >
              {slide.headline}
            </div>
            {slide.body && (
              <div
                style={{
                  fontSize: 34 * u,
                  lineHeight: 1.35,
                  color: theme.text,
                  marginTop: 28 * u,
                  whiteSpace: "pre-wrap",
                  fontWeight: 600,
                }}
              >
                {slide.body}
              </div>
            )}
          </>
        ) : layout === "list" && !isCover && !isCta ? (
          <>
            <div
              style={{
                fontFamily: theme.fontHead,
                fontSize: headSize,
                fontWeight: headWeight,
                lineHeight: 1.05,
                letterSpacing: -0.5 * u,
                whiteSpace: "pre-wrap",
                marginBottom: 32 * u,
              }}
            >
              {slide.headline}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 * u, width: "100%" }}>
              {slide.body
                .split("\n")
                .map((line) => line.replace(/^[-•—·*]\s*/, "").trim())
                .filter(Boolean)
                .map((line, li) => (
                  <div
                    key={li}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 16 * u,
                      fontSize: bodySize,
                      lineHeight: 1.4,
                      color: theme.body,
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 12 * u,
                        height: 12 * u,
                        borderRadius: 9999,
                        background: theme.accent,
                        flexShrink: 0,
                        marginTop: 12 * u,
                      }}
                    />
                    <span style={{ whiteSpace: "pre-wrap" }}>{line}</span>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                fontFamily: theme.fontHead,
                fontSize: headSize,
                fontWeight: headWeight,
                lineHeight: 1.05,
                letterSpacing: -0.5 * u,
                whiteSpace: "pre-wrap",
              }}
            >
              {slide.headline}
            </div>
            {slide.body && (
              <div
                style={{
                  fontSize: bodySize,
                  lineHeight: 1.4,
                  color: theme.body,
                  marginTop: 28 * u,
                  whiteSpace: "pre-wrap",
                }}
              >
                {slide.body}
              </div>
            )}
          </>
        )}

        {/* CTA-кнопка: настраиваемый текст (из voice defaultCta или
            руками), fallback на handle, чтобы кнопка не была пустой. */}
        {isCta && (
          <div
            style={{
              marginTop: 44 * u,
              alignSelf: alignItems,
              background: theme.accent,
              color: theme.accentText,
              fontFamily: theme.fontHead,
              fontWeight: 700,
              fontSize: 30 * u,
              padding: `${20 * u}px ${40 * u}px`,
              borderRadius: 9999,
              maxWidth: "100%",
            }}
          >
            {(ctaText || handle || "Напиши мне").trim()} →
          </div>
        )}
      </div>

      {/* Swipe-хинт на обложке: пилюля с текстом и стрелкой в нижнем
          правом углу (или слева при align=right, чтобы не толкаться с
          брендинг-плашкой). Ключевой виральный элемент — говорит
          зрителю, что это карусель, а не одиночная картинка. */}
      {isCover && showSwipeHint && (
        <div
          style={{
            position: "absolute",
            bottom: pad,
            ...(align === "right" ? { left: pad } : { right: pad }),
            display: "flex",
            alignItems: "center",
            gap: 10 * u,
            background: theme.accent,
            color: theme.accentText,
            fontFamily: theme.fontHead,
            fontWeight: 700,
            fontSize: 24 * u,
            padding: `${14 * u}px ${28 * u}px`,
            borderRadius: 9999,
            zIndex: 3,
            whiteSpace: "nowrap",
          }}
        >
          {swipeText || "Листай"}
          <span style={{ fontSize: 26 * u, lineHeight: 1 }}>→</span>
        </div>
      )}

      {/* Брендинг-плашка автора: круглый аватар + имя + @handle.
          Заменяет старый текстовый футер. Показывается на всех слайдах
          кроме CTA (там есть кнопка). Если нет ни имени, ни аватара —
          рендерим просто handle, как раньше. */}
      {showHandle && !isCta && (
        <div
          style={{
            position: "absolute",
            bottom: pad,
            display: "flex",
            alignItems: "center",
            gap: 14 * u,
            zIndex: 2,
            ...footerSide,
            ...(align === "center"
              ? { justifyContent: "center" }
              : align === "right"
                ? { flexDirection: "row-reverse" as const }
                : {}),
          }}
        >
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt=""
              crossOrigin="anonymous"
              style={{
                width: 52 * u,
                height: 52 * u,
                borderRadius: 9999,
                objectFit: "cover",
                border: `${2 * u}px solid ${theme.accent}`,
                flexShrink: 0,
              }}
            />
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2 * u,
              textAlign: align === "right" ? "right" : "left",
            }}
          >
            {authorName && (
              <span
                style={{
                  fontFamily: theme.fontHead,
                  fontSize: kickerSize,
                  fontWeight: 700,
                  color: theme.text,
                  lineHeight: 1.15,
                }}
              >
                {authorName}
              </span>
            )}
            {handle && (
              <span
                style={{
                  fontFamily: theme.fontHead,
                  fontSize: authorName ? 18 * u : kickerSize,
                  fontWeight: 600,
                  color: theme.body,
                  lineHeight: 1.15,
                }}
              >
                {handle}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

