import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Library as LibIcon, Copy, Check, Trash2, Sparkles } from "lucide-react";

type Mode = "pack" | "post" | "reels" | "hooks" | "hashtags" | "carousel";

type LibraryItem = {
  id: string;
  createdAt: number;
  title: string;
  mode: Mode;
  payload: Record<string, unknown>;
};

const LIB_KEY = "serbolin.studio.library.v1";

const MODE_LABEL: Record<Mode, string> = {
  pack: "Пакет",
  post: "Пост",
  reels: "Reels",
  hooks: "Хуки",
  hashtags: "Хештеги",
  carousel: "Карусель",
};

const load = (): LibraryItem[] => {
  try {
    return JSON.parse(localStorage.getItem(LIB_KEY) || "[]");
  } catch {
    return [];
  }
};
const save = (items: LibraryItem[]) =>
  localStorage.setItem(LIB_KEY, JSON.stringify(items));

const previewOf = (item: LibraryItem): string => {
  const p = item.payload as Record<string, unknown>;
  if (typeof p.post === "string") return p.post as string;
  if (typeof p.script === "string") return p.script as string;
  if (typeof p.carousel === "string") return p.carousel as string;
  if (Array.isArray(p.hooks)) return (p.hooks as string[]).join("\n");
  if (Array.isArray(p.hashtags)) return (p.hashtags as string[]).join(" ");
  return JSON.stringify(p, null, 2);
};

export default function Library() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Mode>("all");

  useEffect(() => {
    setItems(load());
  }, []);

  const filtered = filter === "all" ? items : items.filter((i) => i.mode === filter);

  const remove = (id: string) => {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    save(next);
  };

  const clear = () => {
    if (!confirm("Очистить всю библиотеку?")) return;
    setItems([]);
    save([]);
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <section style={{ padding: "56px 0 16px" }}>
        <div className="container">
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Библиотека
          </div>
          <h1>
            Сохранённый <span style={{ color: "var(--brand-gold)" }}>контент.</span>
          </h1>
          <p
            className="text-platinum"
            style={{ maxWidth: 620, fontSize: 18, lineHeight: 1.5, marginTop: 18 }}
          >
            Всё, что сгенерировал в Студии и нажал «В библиотеку», лежит здесь.
            Локально, в браузере — никаких аккаунтов.
          </p>
        </div>
      </section>

      <section style={{ padding: "24px 0" }}>
        <div className="container">
          <div
            className="flex items-center justify-between gap-3 flex-wrap"
            style={{ marginBottom: 24 }}
          >
            <div
              style={{
                display: "inline-flex",
                gap: 4,
                padding: 4,
                background: "var(--ink-2)",
                borderRadius: 9999,
              }}
            >
              {(["all", "pack", "post", "reels", "hooks", "hashtags", "carousel"] as const).map(
                (k) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 9999,
                      border: 0,
                      fontFamily: "var(--font-body)",
                      fontSize: 12,
                      fontWeight: 600,
                      background: filter === k ? "var(--brand-gold)" : "transparent",
                      color: filter === k ? "var(--ink)" : "var(--brand-platinum)",
                    }}
                  >
                    {k === "all" ? "Все" : MODE_LABEL[k]}
                  </button>
                )
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Link href="/generator">
                <span className="btn-gold">
                  <Sparkles className="w-4 h-4" />
                  Создать ещё
                </span>
              </Link>
              {items.length > 0 && (
                <button
                  onClick={clear}
                  className="btn-gold"
                  style={{ background: "var(--ink-2)", color: "#fff" }}
                >
                  <Trash2 className="w-4 h-4" /> Очистить
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div
              className="bento-card"
              style={{
                padding: 56,
                textAlign: "center",
              }}
            >
              <LibIcon
                className="w-12 h-12"
                style={{
                  color: "var(--brand-gold)",
                  opacity: 0.5,
                  margin: "0 auto 16px",
                }}
              />
              <h3 style={{ marginBottom: 8 }}>Здесь пусто</h3>
              <p className="text-platinum" style={{ fontSize: 14 }}>
                Сгенерируй что-нибудь в Студии и нажми «В библиотеку».
              </p>
            </div>
          ) : (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))" }}
            >
              {filtered.map((it) => {
                const preview = previewOf(it);
                return (
                  <div key={it.id} className="bento-card">
                    <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                      <div
                        className="eyebrow"
                        style={{
                          padding: "4px 10px",
                          background: "var(--gold-soft-fill)",
                          borderRadius: 9999,
                          color: "var(--brand-gold)",
                        }}
                      >
                        {MODE_LABEL[it.mode]}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--muted-foreground)",
                        }}
                      >
                        {new Date(it.createdAt).toLocaleDateString("ru-RU")}
                      </span>
                    </div>
                    <h3
                      style={{
                        fontSize: 17,
                        lineHeight: 1.3,
                        letterSpacing: "-0.3px",
                        marginBottom: 10,
                      }}
                    >
                      {it.title}
                    </h3>
                    <p
                      className="text-platinum"
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        marginBottom: 14,
                      }}
                    >
                      {preview}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copy(preview, it.id)}
                        className="btn-gold"
                        style={{
                          background: "var(--ink-2)",
                          color: "#fff",
                          padding: "8px 12px",
                          fontSize: 12,
                          flex: 1,
                          justifyContent: "center",
                        }}
                      >
                        {copied === it.id ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        Копировать
                      </button>
                      <button
                        onClick={() => remove(it.id)}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 9999,
                          padding: "8px 12px",
                          color: "var(--muted-foreground)",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
