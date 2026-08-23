import { useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  Copy,
  Check,
  KeyRound,
  RefreshCw,
  CloudOff,
  Cloud,
  Send,
  Plus,
  Trash2,
  Loader2,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function Settings() {
  const { workspaceKey, setWorkspaceKey, generateNew, cloudEnabled } = useWorkspace();
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(workspaceKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <section style={{ padding: "56px 0 16px" }}>
        <div className="container">
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Синхронизация · Workspace
          </div>
          <h1>
            Один ключ — <span style={{ color: "var(--brand-gold)" }}>все устройства.</span>
          </h1>
          <p
            className="text-platinum"
            style={{ maxWidth: 640, fontSize: 18, lineHeight: 1.5, marginTop: 18 }}
          >
            Никаких аккаунтов и паролей. Скопируй ключ — вставь его на другом
            устройстве, и контент-библиотека, расписание и прогресс публикаций
            подтянутся автоматически.
          </p>
        </div>
      </section>

      <section style={{ padding: "16px 0 96px" }}>
        <div className="container grid gap-4" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)" }}>
          <div className="bento-card" style={{ padding: 28 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <div className="eyebrow">Твой workspace key</div>
              {cloudEnabled ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 9999,
                    background: "rgba(212,168,67,0.12)",
                    color: "var(--brand-gold)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  <Cloud className="w-3 h-3" /> Cloud sync
                </span>
              ) : (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 9999,
                    background: "rgba(255,255,255,0.06)",
                    color: "var(--muted-foreground)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  <CloudOff className="w-3 h-3" /> Только локально
                </span>
              )}
            </div>
            <div
              style={{
                background: "var(--ink-3)",
                borderRadius: 14,
                padding: "20px 24px",
                fontFamily: "var(--font-display)",
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: "0.4em",
                textAlign: "center",
                color: "var(--brand-gold)",
                marginBottom: 14,
              }}
            >
              {workspaceKey || "..."}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={copy} className="btn-gold">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Скопировано" : "Копировать ключ"}
              </button>
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Создать новый ключ? Текущий будет утерян — все локальные ссылки на старые данные исчезнут."
                    )
                  )
                    generateNew();
                }}
                className="btn-gold"
                style={{ background: "var(--ink-2)", color: "#fff" }}
              >
                <RefreshCw className="w-4 h-4" /> Новый ключ
              </button>
            </div>
            {!cloudEnabled && (
              <p
                style={{
                  marginTop: 18,
                  padding: 14,
                  borderRadius: 14,
                  background: "rgba(212,168,67,0.08)",
                  border: "1px solid var(--gold-medal-edge)",
                  color: "var(--brand-platinum)",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Cloudflare D1 пока не подключён к этому серверу. Данные хранятся в
                браузере (localStorage). Чтобы включить синхронизацию между
                устройствами, задеплой сборку и пропиши
                <code style={{ color: "var(--brand-gold)" }}> CLOUDFLARE_ACCOUNT_ID</code>,
                <code style={{ color: "var(--brand-gold)" }}> CLOUDFLARE_D1_DATABASE_ID</code> и
                <code style={{ color: "var(--brand-gold)" }}> CLOUDFLARE_API_TOKEN</code> в env.
              </p>
            )}
          </div>

          <div className="bento-card" style={{ padding: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              <KeyRound className="w-4 h-4 inline mr-1" /> Подхватить с другого устройства
            </div>
            <p
              className="text-platinum"
              style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}
            >
              Вставь ключ с другого устройства — Студия перезагрузится с его
              данными.
            </p>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="XXXXXXXX"
              style={{
                width: "100%",
                height: 48,
                padding: "0 16px",
                background: "var(--ink-3)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                color: "#fff",
                fontFamily: "var(--font-display)",
                fontSize: 18,
                letterSpacing: "0.2em",
                textAlign: "center",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            />
            <button
              onClick={() => setWorkspaceKey(input)}
              disabled={input.trim().length < 6}
              className="btn-gold"
              style={{ width: "100%", justifyContent: "center" }}
            >
              Подключиться к ключу
            </button>
          </div>
        </div>
      </section>

      {cloudEnabled && <TelegramChatsSection />}
    </div>
  );
}

/* Управление Telegram-каналами для публикации. Несколько каналов на
   workspace, один помечен default — именно в него уходит кнопка
   «Отправить в Telegram» из Студии, если юзер не выбрал явно другой.
   При добавлении бот валидирует доступ через getChat — частая ошибка
   «бот не админ канала» ловится сразу. */
function TelegramChatsSection() {
  const { workspaceKey } = useWorkspace();
  const list = trpc.telegram.chats.list.useQuery(undefined,
    { enabled: !!workspaceKey },
  );
  const addChat = trpc.telegram.chats.add.useMutation({
    onSuccess: (r) => {
      list.refetch();
      toast.success(`Канал добавлен: ${r.title ?? r.chatId}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const setDefault = trpc.telegram.chats.setDefault.useMutation({
    onSuccess: () => list.refetch(),
  });
  const delChat = trpc.telegram.chats.delete.useMutation({
    onSuccess: () => list.refetch(),
  });

  const [newChat, setNewChat] = useState("");
  const chats = list.data ?? [];

  const handleAdd = () => {
    const cleaned = newChat
      .trim()
      .replace(/^https?:\/\/t\.me\//i, "@")
      .replace(/\/$/, "");
    if (!cleaned) return;
    addChat.mutate({
      chatId: cleaned,
      makeDefault: chats.length === 0,
    });
    setNewChat("");
  };

  return (
    <section style={{ padding: "0 0 96px" }}>
      <div className="container">
        <div className="bento-card" style={{ padding: 28 }}>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 6 }}>
            <Send className="w-5 h-5" style={{ color: "var(--brand-gold)" }} />
            <h2 style={{ fontSize: 22, margin: 0, letterSpacing: "-0.4px" }}>
              Telegram-каналы для отправки
            </h2>
          </div>
          <p
            className="text-platinum"
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              marginBottom: 18,
              maxWidth: 720,
            }}
          >
            Добавь канал(ы), куда из Студии будет улетать кнопка
            «Отправить в Telegram». Для каждого: <strong>бот должен быть
            админом канала</strong> с правом «Отправлять сообщения». Иначе при
            добавлении вернётся ошибка от Telegram. Формат: <code>@username</code>
            {" "}публичного канала или <code>-1001234567890</code> приватного.
            Звёздочкой помечен дефолтный канал.
          </p>

          <div
            className="flex gap-2"
            style={{ marginBottom: 16, flexWrap: "wrap" }}
          >
            <input
              value={newChat}
              onChange={(e) => setNewChat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="@mychannel или -1001234567890"
              style={{
                flex: 1,
                minWidth: 240,
                background: "var(--ink-3)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 9999,
                padding: "10px 16px",
                fontFamily: "var(--font-body)",
                fontSize: 14,
              }}
            />
            <button
              onClick={handleAdd}
              disabled={addChat.isPending || !newChat.trim()}
              className="btn-gold"
              style={{ padding: "10px 18px" }}
            >
              {addChat.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Добавить
            </button>
          </div>

          {list.isLoading ? (
            <div className="text-platinum" style={{ fontSize: 13 }}>
              <Loader2
                className="w-4 h-4 animate-spin"
                style={{ display: "inline", marginRight: 8 }}
              />
              Загружаю...
            </div>
          ) : chats.length === 0 ? (
            <div
              className="text-platinum"
              style={{ fontSize: 13, opacity: 0.7 }}
            >
              Пока нет добавленных каналов. Без них «Отправить в Telegram»
              в Студии будет использовать чат из переменной TELEGRAM_CHAT_ID
              (если задана).
            </div>
          ) : (
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              }}
            >
              {chats.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: "12px 14px",
                    background: c.isDefault
                      ? "rgba(212,168,67,0.08)"
                      : "var(--ink-2)",
                    border: c.isDefault
                      ? "1px solid rgba(212,168,67,0.4)"
                      : "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12,
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <button
                    onClick={() =>
                      !c.isDefault &&
                      setDefault.mutate({ id: c.id })
                    }
                    title={
                      c.isDefault ? "Уже дефолтный" : "Сделать дефолтным"
                    }
                    style={{
                      background: "transparent",
                      border: 0,
                      color: c.isDefault
                        ? "var(--brand-gold)"
                        : "var(--muted-foreground)",
                      cursor: c.isDefault ? "default" : "pointer",
                      padding: 4,
                      lineHeight: 0,
                    }}
                  >
                    <Star
                      className="w-4 h-4"
                      style={{
                        fill: c.isDefault ? "var(--brand-gold)" : "none",
                      }}
                    />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#fff",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.title ?? c.chatId}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        fontFamily: "monospace",
                      }}
                    >
                      {c.chatId}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `Убрать «${c.title ?? c.chatId}» из списка? Сами сообщения в Telegram не удалятся.`,
                        )
                      ) {
                        delChat.mutate({ id: c.id });
                      }
                    }}
                    title="Убрать"
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "var(--muted-foreground)",
                      cursor: "pointer",
                      padding: 4,
                      lineHeight: 0,
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
