import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Library as LibIcon, Copy, Check, Trash2, Sparkles, Cloud, CloudOff, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { localLibrary, localCalendar, type LibraryItem, type Mode } from "@/lib/syncStorage";

const MODE_LABEL: Record<Mode, string> = {
  pack: "Пакет",
  post: "Пост",
  reels: "Reels",
  hooks: "Хуки",
  hashtags: "Хештеги",
  carousel: "Карусель",
};

const previewOf = (item: LibraryItem): string => {
  const p = item.payload as Record<string, unknown>;
  if (typeof p.post === "string") return p.post as string;
  if (typeof p.script === "string") return p.script as string;
  if (typeof p.carousel === "string") return p.carousel as string;
  if (Array.isArray(p.hooks)) {
    /* После #6 элементы хуков могут быть либо строками (старый формат
       в pack.data), либо {text, score, pattern, reason} (новый формат
       hooks-mode). Поддерживаем оба. */
    return (p.hooks as Array<string | { text?: string }>)
      .map((h) => (typeof h === "string" ? h : (h?.text ?? "")))
      .filter(Boolean)
      .join("\n");
  }
  if (Array.isArray(p.hashtags)) return (p.hashtags as string[]).join(" ");
  return JSON.stringify(p, null, 2);
};

/* Когда вызывается с embedded=true (из /plan через табы),
   собственный hero-хедер и обёртка min-h-screen не рендерятся. */
export default function Library({ embedded = false }: { embedded?: boolean }) {
  const { workspaceKey, cloudEnabled } = useWorkspace();
  const [localItems, setLocalItems] = useState<LibraryItem[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Mode>("all");

  const cloudList = trpc.sync.library.list.useQuery(
    { workspaceKey, limit: 200 },
    { enabled: cloudEnabled && workspaceKey.length > 0 }
  );
  const cloudDelete = trpc.sync.library.delete.useMutation({
    onSuccess: () => cloudList.refetch(),
  });
  const cloudClear = trpc.sync.library.clear.useMutation({
    onSuccess: () => cloudList.refetch(),
  });
  const cloudSchedule = trpc.sync.scheduled.save.useMutation();

  const addToPlan = (item: LibraryItem) => {
    /* Идея #2: ставим в календарь на завтра по умолчанию,
       формат подтягиваем из mode. Пользователь дальше двигает DnD. */
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);
    const format =
      item.mode === "reels"
        ? "Reels"
        : item.mode === "carousel"
          ? "Карусель"
          : item.mode === "hooks"
            ? "Хуки"
            : "Пост";
    if (cloudEnabled) {
      cloudSchedule.mutate(
        { workspaceKey, date, title: item.title, format },
        {
          onSuccess: () => toast.success(`В план на ${date}`),
          onError: (e) => toast.error(e.message),
        },
      );
    } else {
      localCalendar.add({
        id: "lib-" + Date.now(),
        date,
        title: item.title,
        format,
      });
      toast.success(`В план на ${date}`);
    }
  };

  useEffect(() => {
    if (!cloudEnabled) setLocalItems(localLibrary.load());
  }, [cloudEnabled]);

  const items: LibraryItem[] = useMemo(() => {
    if (cloudEnabled) {
      return (cloudList.data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        mode: r.mode as Mode,
        platform: r.platform ?? undefined,
        payload: r.payload as Record<string, unknown>,
        createdAt: r.createdAt,
      }));
    }
    return localItems;
  }, [cloudEnabled, cloudList.data, localItems]);

  const filtered = filter === "all" ? items : items.filter((i) => i.mode === filter);

  const remove = (id: string) => {
    if (cloudEnabled) cloudDelete.mutate({ workspaceKey, id });
    else {
      localLibrary.remove(id);
      setLocalItems(localLibrary.load());
    }
  };

  const clear = () => {
    if (!confirm("Очистить всю библиотеку?")) return;
    if (cloudEnabled) cloudClear.mutate({ workspaceKey });
    else {
      localLibrary.clear();
      setLocalItems([]);
    }
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1600);
  };

  const inner = (
    <>
      {!embedded && (
      <section style={{ padding: "56px 0 16px" }}>
        <div className="container">
          <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
            <span className="eyebrow">Библиотека</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 9999,
                background: cloudEnabled
                  ? "rgba(212,168,67,0.12)"
                  : "rgba(255,255,255,0.06)",
                color: cloudEnabled ? "var(--brand-gold)" : "var(--muted-foreground)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {cloudEnabled ? (
                <>
                  <Cloud className="w-3 h-3" /> Cloud sync · {workspaceKey}
                </>
              ) : (
                <>
                  <CloudOff className="w-3 h-3" /> Локально
                </>
              )}
            </span>
          </div>
          <h1>
            Сохранённый <span style={{ color: "var(--brand-gold)" }}>контент.</span>
          </h1>
          <p
            className="text-platinum"
            style={{ maxWidth: 620, fontSize: 18, lineHeight: 1.5, marginTop: 18 }}
          >
            Всё, что сгенерировал и сохранил, ждёт тебя здесь — на этом устройстве
            или на любом другом с тем же workspace-ключом.
          </p>
        </div>
      </section>
      )}

      <section style={{ padding: "24px 0 96px" }}>
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
                      cursor: "pointer",
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

          {cloudEnabled && cloudList.isLoading ? (
            <div className="bento-card" style={{ padding: 56, textAlign: "center" }}>
              <p className="text-platinum">Загружаю...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bento-card" style={{ padding: 56, textAlign: "center" }}>
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
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
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
                        {copied === it.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        Копировать
                      </button>
                      <button
                        onClick={() => addToPlan(it)}
                        className="btn-gold"
                        style={{
                          padding: "8px 12px",
                          fontSize: 12,
                          justifyContent: "center",
                        }}
                        title="Поставить в календарь на завтра"
                      >
                        <CalendarPlus className="w-3 h-3" />
                        В план
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
    </>
  );

  return embedded ? (
    inner
  ) : (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {inner}
    </div>
  );
}
