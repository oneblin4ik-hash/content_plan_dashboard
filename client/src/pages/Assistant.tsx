import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Sparkles, Send, Loader2, Wand2, RotateCcw } from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/* ============================================================
   /assistant — контент-помощник в формате чата.
   «Что постить сегодня?» — главная фича, аналог AI-агента Virale.

   Диалог хранится в state (не персистится). История целиком уходит
   на сервер при каждом вопросе — сервер подмешивает голос автора,
   метрики и темы из библиотеки. Ответ рендерится через Streamdown
   (markdown), т.к. ассистент часто отвечает списками.
   ============================================================ */

type Msg = { role: "user" | "assistant"; content: string };

export default function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const intro = trpc.assistant.intro.useQuery();
  const ask = trpc.assistant.ask.useMutation();

  /* Автоскролл вниз при новых сообщениях / в процессе ответа. */
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, ask.isPending]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || ask.isPending) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    try {
      const r = await ask.mutateAsync({ messages: next });
      setMessages((m) => [...m, { role: "assistant", content: r.reply }]);
    } catch (e) {
      /* откатываем оптимистичную реплику юзера, чтобы он мог
         отправить заново (например, если кончились токены). */
      setMessages((m) => m.slice(0, -1));
      setInput(q);
      toast.error(e instanceof Error ? e.message : "Не удалось получить ответ");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const empty = messages.length === 0;

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--background)",
        display: "flex",
        flexDirection: "column",
        /* фиксируем высоту вьюпорта, чтобы поле ввода липло к низу,
           а скроллилась только лента. На mobile вычитаем nav. */
        height: "100vh",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 0 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <div
          className="container"
          style={{ display: "flex", alignItems: "center", gap: 12 }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: "rgba(212,168,67,0.14)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--brand-gold)",
              flexShrink: 0,
            }}
          >
            <Sparkles className="w-5 h-5" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.3px",
              }}
            >
              Контент-помощник
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {intro.data
                ? intro.data.topicsCount > 0
                  ? `Знаю о тебе и ${intro.data.topicsCount} твоих темах`
                  : "Спроси что угодно про твой контент"
                : "…"}
            </div>
          </div>
          {!empty && (
            <button
              onClick={() => setMessages([])}
              title="Очистить диалог"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                background: "var(--ink-2)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 9999,
                color: "var(--brand-platinum)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Новый
            </button>
          )}
        </div>
      </div>

      {/* Лента сообщений */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: "auto", padding: "24px 0" }}
      >
        <div
          className="container"
          style={{
            maxWidth: 760,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {empty ? (
            <EmptyState
              suggestions={intro.data?.suggestions ?? []}
              onPick={(s) => send(s)}
            />
          ) : (
            messages.map((m, i) => <Bubble key={i} msg={m} />)
          )}

          {ask.isPending && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "var(--muted-foreground)",
                fontSize: 13,
                paddingLeft: 4,
              }}
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Думаю...
            </div>
          )}
        </div>
      </div>

      {/* Поле ввода */}
      <div
        style={{
          flexShrink: 0,
          padding: "14px 0 20px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "var(--background)",
        }}
      >
        <div className="container" style={{ maxWidth: 760 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
              background: "var(--ink-2)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: 8,
            }}
          >
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Спроси про идеи, форматы, план..."
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                background: "transparent",
                border: 0,
                outline: "none",
                color: "#fff",
                fontSize: 15,
                lineHeight: 1.5,
                padding: "8px 10px",
                maxHeight: 160,
                fontFamily: "var(--font-body)",
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || ask.isPending}
              className="btn-gold"
              style={{
                width: 42,
                height: 42,
                padding: 0,
                justifyContent: "center",
                borderRadius: 12,
                flexShrink: 0,
                opacity: !input.trim() || ask.isPending ? 0.5 : 1,
              }}
            >
              {ask.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--muted-foreground)",
              textAlign: "center",
              marginTop: 8,
            }}
          >
            Помощник советует и направляет. Для готового текста —{" "}
            <Link href="/generator">
              <span style={{ color: "var(--brand-gold)", cursor: "pointer" }}>
                открой Студию
              </span>
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (s: string) => void;
}) {
  return (
    <div style={{ textAlign: "center", padding: "32px 0" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "rgba(212,168,67,0.12)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--brand-gold)",
          marginBottom: 18,
        }}
      >
        <Wand2 className="w-7 h-7" />
      </div>
      <h2
        style={{
          fontSize: 24,
          letterSpacing: "-0.4px",
          color: "#fff",
          marginBottom: 10,
        }}
      >
        Чем помочь с контентом?
      </h2>
      <p
        className="text-platinum"
        style={{
          fontSize: 14,
          lineHeight: 1.5,
          maxWidth: 440,
          margin: "0 auto 28px",
        }}
      >
        Я знаю твою нишу, аудиторию и что у тебя заходило. Спроси что
        угодно — или начни с готового вопроса:
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: 440,
          margin: "0 auto",
        }}
      >
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            style={{
              textAlign: "left",
              padding: "13px 16px",
              background: "var(--ink-2)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              color: "var(--brand-platinum)",
              fontSize: 14,
              cursor: "pointer",
              transition: "background 0.12s, border-color 0.12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(212,168,67,0.08)";
              e.currentTarget.style.borderColor = "rgba(212,168,67,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--ink-2)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: isUser ? "82%" : "100%",
          padding: isUser ? "11px 16px" : "0 2px",
          background: isUser ? "var(--brand-gold)" : "transparent",
          color: isUser ? "var(--ink)" : "var(--foreground)",
          borderRadius: isUser ? 16 : 0,
          fontSize: 15,
          lineHeight: 1.55,
        }}
      >
        {isUser ? (
          <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
        ) : (
          <div className="assistant-md">
            <Streamdown>{msg.content}</Streamdown>
          </div>
        )}
      </div>
    </div>
  );
}
