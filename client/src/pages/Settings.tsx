import { useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Copy, Check, KeyRound, RefreshCw, CloudOff, Cloud } from "lucide-react";

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
    </div>
  );
}
