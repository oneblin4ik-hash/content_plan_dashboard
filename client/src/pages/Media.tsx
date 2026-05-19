import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Image as ImageIcon,
  Loader2,
  Plus,
  Search,
  Trash2,
  Sparkles,
} from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function Media() {
  const { workspaceKey, cloudEnabled } = useWorkspace();
  const list = trpc.media.list.useQuery(
    { workspaceKey: workspaceKey ?? "", limit: 60 },
    { enabled: !!workspaceKey && cloudEnabled },
  );
  const add = trpc.media.add.useMutation({
    onSuccess: () => list.refetch(),
  });
  const del = trpc.media.delete.useMutation({
    onSuccess: () => list.refetch(),
  });
  const [q, setQ] = useState("");
  const search = trpc.media.search.useQuery(
    { workspaceKey: workspaceKey ?? "", q },
    { enabled: !!workspaceKey && cloudEnabled && q.trim().length > 0 },
  );
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    tags: "",
    sourceUrl: "",
    contentType: "image" as "image" | "video",
  });

  const items =
    q.trim().length > 0 && search.data ? search.data : list.data ?? [];

  return (
    <main>
      <section style={{ padding: "48px 0 32px" }}>
        <div className="container">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            <ImageIcon
              className="w-3.5 h-3.5"
              style={{ display: "inline", marginRight: 6 }}
            />
            Медиа-банк
          </div>
          <h1
            style={{
              fontSize: 56,
              lineHeight: 1.05,
              letterSpacing: "-1.5px",
              marginBottom: 14,
            }}
          >
            Твой архив{" "}
            <span style={{ color: "var(--brand-gold)" }}>визуала</span>
          </h1>
          <p
            className="text-platinum"
            style={{ fontSize: 17, maxWidth: 720, marginBottom: 24 }}
          >
            Складываешь сюда фото и видео по ссылкам, описываешь их словами —
            и потом, когда сгенерируешь пост в Студии, кнопка «Подобрать
            визуал» предложит 3 подходящих кадра из банка через AI.
          </p>

          {!cloudEnabled && (
            <div
              className="bento-card"
              style={{
                padding: 20,
                marginBottom: 24,
                borderLeft: "3px solid var(--brand-gold)",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                Сначала включи синхронизацию
              </div>
              <div className="text-platinum" style={{ fontSize: 13 }}>
                Медиа-банк хранится в облаке и привязан к твоему workspace key.
                Открой «Sync» в навигации, чтобы сгенерировать ключ.
              </div>
            </div>
          )}

          {cloudEnabled && (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 24,
                }}
              >
                <button
                  onClick={() => setShowAdd((v) => !v)}
                  className="btn-gold gold-glow"
                  style={{ padding: "12px 20px", fontSize: 14 }}
                >
                  <Plus className="w-4 h-4" />
                  {showAdd ? "Закрыть форму" : "Добавить медиа"}
                </button>
                <div
                  style={{
                    flex: 1,
                    minWidth: 240,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    background: "var(--ink-3)",
                    borderRadius: 14,
                    padding: "10px 14px",
                  }}
                >
                  <Search className="w-4 h-4 text-platinum" />
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Поиск по тегам и описанию..."
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: 0,
                      color: "#fff",
                      outline: "none",
                      fontSize: 14,
                    }}
                  />
                </div>
              </div>

              {showAdd && (
                <div
                  className="bento-card"
                  style={{ padding: 24, marginBottom: 24 }}
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                      placeholder="Название (например: тренировка ягодицы, кадр 1)"
                      style={inputStyle}
                    />
                    <input
                      type="url"
                      value={form.sourceUrl}
                      onChange={(e) =>
                        setForm({ ...form, sourceUrl: e.target.value })
                      }
                      placeholder="URL изображения/видео (https://...)"
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      value={form.tags}
                      onChange={(e) =>
                        setForm({ ...form, tags: e.target.value })
                      }
                      placeholder="Теги через запятую (ягодицы, дом, женщины)"
                      style={inputStyle}
                    />
                    <select
                      value={form.contentType}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          contentType: e.target.value as "image" | "video",
                        })
                      }
                      style={inputStyle}
                    >
                      <option value="image">Изображение</option>
                      <option value="video">Видео</option>
                    </select>
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      placeholder="Подробное описание: что на кадре, настроение, кто в кадре, в какой пост подходит"
                      rows={3}
                      style={{ ...inputStyle, gridColumn: "1 / -1" }}
                    />
                  </div>
                  <button
                    onClick={async () => {
                      if (!workspaceKey) return;
                      if (
                        form.title.trim().length < 1 ||
                        form.sourceUrl.trim().length < 5
                      )
                        return;
                      await add.mutateAsync({
                        workspaceKey,
                        title: form.title.trim(),
                        description: form.description.trim(),
                        tags: form.tags
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                        sourceUrl: form.sourceUrl.trim(),
                        contentType: form.contentType,
                      });
                      setForm({
                        title: "",
                        description: "",
                        tags: "",
                        sourceUrl: "",
                        contentType: "image",
                      });
                      setShowAdd(false);
                    }}
                    disabled={add.isPending}
                    className="btn-gold"
                    style={{ marginTop: 16, padding: "10px 20px" }}
                  >
                    {add.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Сохраняю...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Добавить в банк
                      </>
                    )}
                  </button>
                </div>
              )}

              {items.length === 0 && !list.isLoading && (
                <div className="bento-card" style={{ padding: 24 }}>
                  <div className="text-platinum" style={{ fontSize: 14 }}>
                    {q.trim().length > 0
                      ? "Ничего не нашлось. Попробуй другой запрос."
                      : "Банк пуст. Нажми «Добавить медиа», чтобы загрузить первое."}
                  </div>
                </div>
              )}

              {items.length > 0 && (
                <div
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  }}
                >
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className="bento-card"
                      style={{
                        padding: 0,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{
                          aspectRatio: "1 / 1",
                          background: "var(--ink-3)",
                          backgroundImage: `url(${
                            it.thumbnailUrl ?? it.sourceUrl
                          })`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                      <div style={{ padding: 14, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 14,
                            marginBottom: 4,
                          }}
                        >
                          {it.title}
                        </div>
                        {it.tags.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 4,
                              marginBottom: 8,
                            }}
                          >
                            {it.tags.slice(0, 4).map((t) => (
                              <span
                                key={t}
                                style={{
                                  fontSize: 10,
                                  padding: "2px 8px",
                                  background: "var(--gold-soft-fill)",
                                  color: "var(--brand-gold)",
                                  borderRadius: 9999,
                                }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {it.description && (
                          <div
                            className="text-platinum"
                            style={{
                              fontSize: 12,
                              lineHeight: 1.4,
                              opacity: 0.7,
                            }}
                          >
                            {it.description.slice(0, 100)}
                            {it.description.length > 100 ? "..." : ""}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (!workspaceKey) return;
                          if (!confirm("Удалить из банка?")) return;
                          del.mutate({ workspaceKey, id: it.id });
                        }}
                        style={{
                          background: "transparent",
                          border: 0,
                          borderTop: "1px solid rgba(255,255,255,0.06)",
                          color: "var(--brand-platinum)",
                          padding: "10px",
                          cursor: "pointer",
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--ink-3)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 14,
  padding: "10px 14px",
  fontSize: 14,
  fontFamily: "var(--font-body)",
  width: "100%",
};
