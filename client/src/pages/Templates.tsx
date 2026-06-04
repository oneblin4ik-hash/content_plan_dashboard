import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Sparkles, Search, ArrowUpRight, Bookmark } from "lucide-react";
import {
  VIRAL_TEMPLATES,
  CATEGORY_LABELS,
  type ViralTemplate,
  type TemplateCategory,
} from "@/lib/viralTemplates";

/* ============================================================
   /templates — витрина вирусных шаблонов (P1.1).
   Юзер выбирает шаблон → жмёт «Применить» → попадает в Студию с
   pre-filled templateId. На сервере content.generatePost подмешивает
   жёсткую структуру шаблона в task-промпт.

   Поиск по названию/превью + фильтр по категории. Без сложных
   фильтров — каталог небольшой (~17 шаблонов), важна скорость
   выбора, а не богатая фильтрация.
   ============================================================ */

export default function Templates() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [opened, setOpened] = useState<ViralTemplate | null>(null);

  /* Категории отображаем в порядке, в котором они встречаются в
     каталоге, а не алфавитно — это даёт логику «от хука к схеме». */
  const categories = useMemo<TemplateCategory[]>(() => {
    const seen = new Set<TemplateCategory>();
    const out: TemplateCategory[] = [];
    for (const t of VIRAL_TEMPLATES) {
      if (!seen.has(t.category)) {
        seen.add(t.category);
        out.push(t.category);
      }
    }
    return out;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return VIRAL_TEMPLATES.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.hookPreview.toLowerCase().includes(q) ||
        t.example.toLowerCase().includes(q)
      );
    });
  }, [search, category]);

  const applyTemplate = (t: ViralTemplate) => {
    /* Передаём templateId через query — Студия читает его при
       монтировании, пристёгивает к мутации generatePost. */
    navigate(
      `/generator?templateId=${encodeURIComponent(t.id)}`,
    );
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <section style={{ padding: "40px 0 16px" }}>
        <div className="container">
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            <Bookmark
              className="w-3.5 h-3.5"
              style={{ display: "inline", marginRight: 6 }}
            />
            Шаблоны
          </div>
          <h1 style={{ letterSpacing: "-0.6px" }}>
            Вирусные{" "}
            <span style={{ color: "var(--brand-gold)" }}>паттерны постов</span>
          </h1>
          <p
            className="text-platinum"
            style={{
              maxWidth: 620,
              fontSize: 15,
              marginTop: 14,
              lineHeight: 1.5,
            }}
          >
            Готовые структуры заголовков и постов, которые уже работают.
            Выбери шаблон → введи свою тему — Студия напишет пост, точно
            следуя проверенной структуре.
          </p>
        </div>
      </section>

      <section style={{ padding: "8px 0 96px" }}>
        <div className="container">
          {/* Поиск + категории */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              marginBottom: 22,
            }}
          >
            <label
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Search
                className="w-4 h-4"
                style={{
                  position: "absolute",
                  left: 14,
                  color: "var(--muted-foreground)",
                }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Найти шаблон..."
                style={{
                  width: "100%",
                  height: 44,
                  padding: "0 16px 0 42px",
                  background: "var(--ink-2)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 9999,
                  color: "#fff",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </label>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              <CategoryChip
                label="Все"
                active={category === "all"}
                onClick={() => setCategory("all")}
              />
              {categories.map((c) => (
                <CategoryChip
                  key={c}
                  label={CATEGORY_LABELS[c]}
                  active={category === c}
                  onClick={() => setCategory(c)}
                />
              ))}
            </div>
          </div>

          {/* Сетка шаблонов */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 14,
            }}
          >
            {filtered.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onOpen={() => setOpened(t)}
                onApply={() => applyTemplate(t)}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <p
              className="text-platinum"
              style={{ textAlign: "center", padding: 40, fontSize: 14 }}
            >
              Ничего не нашлось. Попробуй другой запрос.
            </p>
          )}
        </div>
      </section>

      {opened && (
        <TemplateModal
          template={opened}
          onClose={() => setOpened(null)}
          onApply={() => {
            setOpened(null);
            applyTemplate(opened);
          }}
        />
      )}
    </div>
  );
}

/* ─── Подкомпоненты ─────────────────────────────────────── */

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 9999,
        border: 0,
        background: active ? "var(--brand-gold)" : "var(--ink-2)",
        color: active ? "var(--ink)" : "var(--brand-platinum)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function TemplateCard({
  template,
  onOpen,
  onApply,
}: {
  template: ViralTemplate;
  onOpen: () => void;
  onApply: () => void;
}) {
  return (
    <div
      className="bento-card"
      style={{
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div className="eyebrow" style={{ color: "var(--brand-gold)", fontSize: 10 }}>
        {CATEGORY_LABELS[template.category]}
      </div>
      <h3
        style={{
          fontSize: 17,
          fontWeight: 700,
          lineHeight: 1.3,
          letterSpacing: "-0.2px",
          color: "#fff",
          margin: 0,
        }}
      >
        {template.title}
      </h3>
      <div
        style={{
          fontSize: 13,
          fontStyle: "italic",
          color: "var(--brand-platinum)",
          padding: "10px 14px",
          background: "var(--ink-3)",
          borderRadius: 10,
          borderLeft: "2px solid var(--brand-gold)",
          lineHeight: 1.45,
        }}
      >
        «{template.hookPreview}»
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onOpen}
          style={{
            flex: 1,
            padding: "10px 14px",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "var(--brand-platinum)",
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Пример и структура
        </button>
        <button
          onClick={onApply}
          className="btn-gold"
          style={{
            padding: "10px 18px",
            fontSize: 12,
          }}
        >
          Применить
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function TemplateModal({
  template,
  onClose,
  onApply,
}: {
  template: ViralTemplate;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <div
      onClick={onClose}
      role="dialog"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0,0,0,0.6)",
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
          maxWidth: 620,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div className="eyebrow" style={{ color: "var(--brand-gold)" }}>
          {CATEGORY_LABELS[template.category]}
        </div>
        <h2
          style={{
            fontSize: 24,
            margin: 0,
            letterSpacing: "-0.4px",
            color: "#fff",
          }}
        >
          {template.title}
        </h2>

        <Section title="Когда сработает">
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            {template.whenToUse}
          </p>
        </Section>

        <Section title="Хук">
          <div
            style={{
              padding: "12px 14px",
              background: "var(--ink-3)",
              borderRadius: 10,
              fontSize: 14,
              fontStyle: "italic",
              borderLeft: "2px solid var(--brand-gold)",
              lineHeight: 1.5,
            }}
          >
            «{template.hookPreview}»
          </div>
        </Section>

        <Section title="Структура">
          <pre
            style={{
              margin: 0,
              padding: "14px 16px",
              background: "var(--ink-3)",
              borderRadius: 10,
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              fontFamily: "var(--font-body)",
              color: "var(--brand-platinum)",
            }}
          >
            {template.structure}
          </pre>
        </Section>

        <Section title="Пример">
          <pre
            style={{
              margin: 0,
              padding: "14px 16px",
              background: "var(--ink-3)",
              borderRadius: 10,
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              fontFamily: "var(--font-body)",
              color: "#fff",
            }}
          >
            {template.example}
          </pre>
        </Section>

        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px 18px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "var(--brand-platinum)",
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Закрыть
          </button>
          <button
            onClick={onApply}
            className="btn-gold"
            style={{
              flex: 1,
              padding: "12px 18px",
              fontSize: 13,
              justifyContent: "center",
            }}
          >
            <Sparkles className="w-4 h-4" />
            Применить в Студии
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="eyebrow"
        style={{ marginBottom: 8, fontSize: 10 }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
