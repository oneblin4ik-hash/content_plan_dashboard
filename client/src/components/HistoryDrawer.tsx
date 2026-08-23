import { useState } from "react";
import { Clock, X, Trash2, GitCompare, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

/* ============================================================
   HistoryDrawer — выезжающая панель с последними генерациями.
   Используется в Студии: юзер видит свои предыдущие попытки по
   теме, может «подгрузить» удачную версию обратно или сравнить
   две в модалке.

   Сейчас работает только для kind="post" (P1.2 первой итерации).
   После расширения recordGeneration на остальные типы — пропсом
   kind можно переключать.
   ============================================================ */

type Payload = {
  post?: string;
  title?: string;
  tone?: string;
  length?: string;
  rubric?: string;
  templateId?: string | null;
};

export type HistoryItem = {
  id: string;
  kind: string;
  title: string;
  payload: Payload | unknown;
  createdAt: number;
};

export default function HistoryDrawer({
  open,
  onClose,
  currentTitle,
  currentText,
  onPickPayload,
}: {
  open: boolean;
  onClose: () => void;
  /* Если задан — фильтруем историю по этой теме (LIKE). */
  currentTitle?: string;
  /* Текущий результат в Студии — нужен для сравнения «текущий vs
     выбранная версия». Опционален: если пустой, кнопка сравнения
     не показывается. */
  currentText?: string;
  /* Колбэк подстановки выбранной версии. Получает payload, чтобы
     родитель сам решил, как именно применить (например, заменить
     post-результат в state). */
  onPickPayload: (payload: Payload) => void;
}) {
  const list = trpc.history.list.useQuery(
    { titleLike: currentTitle?.trim() ? currentTitle.trim() : undefined, kind: "post", limit: 20 },
    { enabled: open },
  );
  const utils = trpc.useUtils();
  const del = trpc.history.delete.useMutation({
    onSuccess: () => utils.history.list.invalidate(),
  });

  const [compareWith, setCompareWith] = useState<HistoryItem | null>(null);

  if (!open) return null;

  const items = (list.data ?? []) as HistoryItem[];

  return (
    <>
      {/* Затемнение фона */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(6px)",
        }}
      />
      <aside
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          width: "min(440px, 100vw)",
          zIndex: 51,
          background: "var(--ink-2)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Clock className="w-4 h-4" style={{ color: "var(--brand-gold)" }} />
          <div
            style={{
              flex: 1,
              fontSize: 15,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            История генераций
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              background: "transparent",
              border: 0,
              borderRadius: 9999,
              color: "var(--muted-foreground)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {currentTitle?.trim() && (
          <div
            style={{
              padding: "10px 20px",
              fontSize: 11,
              color: "var(--muted-foreground)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            Показаны попытки по теме:{" "}
            <span style={{ color: "var(--brand-gold)" }}>
              «{currentTitle.trim().slice(0, 60)}»
            </span>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {list.isLoading && (
            <div style={{ padding: 24, color: "var(--muted-foreground)" }}>
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              Загружаю...
            </div>
          )}
          {!list.isLoading && items.length === 0 && (
            <div
              style={{
                padding: 28,
                textAlign: "center",
                color: "var(--muted-foreground)",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {currentTitle?.trim()
                ? "По этой теме пока пусто. Сгенерируй пост — он сразу попадёт сюда."
                : "История пустая. Сгенерируй первый пост."}
            </div>
          )}
          {items.map((it) => {
            const p = (it.payload ?? {}) as Payload;
            const text = p.post ?? "";
            const preview = text.slice(0, 160).replace(/\s+/g, " ");
            const date = new Date(it.createdAt);
            return (
              <div
                key={it.id}
                style={{
                  padding: 14,
                  background: "var(--ink-3)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  marginBottom: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                  }}
                >
                  <span>{date.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}</span>
                  {p.tone && (
                    <>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span>{p.tone}</span>
                    </>
                  )}
                  {p.length && (
                    <>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span>{p.length}</span>
                    </>
                  )}
                  {p.templateId && (
                    <span
                      style={{
                        marginLeft: "auto",
                        padding: "2px 7px",
                        background: "rgba(212,168,67,0.16)",
                        color: "var(--brand-gold)",
                        borderRadius: 5,
                        fontWeight: 700,
                        fontSize: 9,
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                      }}
                    >
                      Шаблон
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--brand-platinum)",
                    lineHeight: 1.5,
                  }}
                >
                  {preview}
                  {text.length > 160 ? "…" : ""}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                  <button
                    onClick={() => onPickPayload(p)}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      background: "var(--brand-gold)",
                      color: "var(--ink)",
                      border: 0,
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Открыть в Студии
                  </button>
                  {currentText && currentText !== text && (
                    <button
                      onClick={() => setCompareWith(it)}
                      title="Сравнить с текущим"
                      style={{
                        padding: "8px 12px",
                        background: "transparent",
                        border: "1px solid rgba(212,168,67,0.4)",
                        color: "var(--brand-gold)",
                        borderRadius: 9999,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <GitCompare className="w-3.5 h-3.5" />
                      Сравнить
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (window.confirm("Удалить эту версию из истории?"))
                        del.mutate({ id: it.id });
                    }}
                    title="Удалить"
                    style={{
                      padding: "8px",
                      background: "transparent",
                      border: 0,
                      color: "var(--muted-foreground)",
                      borderRadius: 9999,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {compareWith && currentText && (
        <CompareModal
          left={{ label: "Текущая версия", text: currentText }}
          right={{
            label: `Версия от ${new Date(compareWith.createdAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}`,
            text: ((compareWith.payload as Payload)?.post ?? "") as string,
          }}
          onClose={() => setCompareWith(null)}
          onUseRight={() => {
            onPickPayload((compareWith.payload ?? {}) as Payload);
            setCompareWith(null);
          }}
        />
      )}
    </>
  );
}

/* ─── Модалка side-by-side ─────────────────────────────── */

function CompareModal({
  left,
  right,
  onClose,
  onUseRight,
}: {
  left: { label: string; text: string };
  right: { label: string; text: string };
  onClose: () => void;
  onUseRight: () => void;
}) {
  return (
    <div
      role="dialog"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bento-card"
        style={{
          width: "min(1100px, 100%)",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <GitCompare className="w-4 h-4" style={{ color: "var(--brand-gold)" }} />
          <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "#fff" }}>
            Сравнение версий
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              background: "transparent",
              border: 0,
              borderRadius: 9999,
              color: "var(--muted-foreground)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1,
            background: "rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}
        >
          <ComparePane label={left.label} text={left.text} />
          <ComparePane label={right.label} text={right.text} highlight />
        </div>

        <footer
          style={{
            padding: "14px 20px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 18px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "var(--brand-platinum)",
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Оставить текущую
          </button>
          <button
            onClick={onUseRight}
            className="btn-gold"
            style={{ padding: "10px 18px", fontSize: 13 }}
          >
            Использовать выбранную
          </button>
        </footer>
      </div>
    </div>
  );
}

function ComparePane({
  label,
  text,
  highlight,
}: {
  label: string;
  text: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: highlight ? "rgba(212,168,67,0.04)" : "var(--ink-2)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        className="eyebrow"
        style={{
          marginBottom: 10,
          color: highlight ? "var(--brand-gold)" : "var(--muted-foreground)",
        }}
      >
        {label}
      </div>
      <pre
        style={{
          margin: 0,
          padding: 0,
          fontFamily: "var(--font-body)",
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--foreground)",
          whiteSpace: "pre-wrap",
          overflowY: "auto",
          flex: 1,
        }}
      >
        {text}
      </pre>
    </div>
  );
}
