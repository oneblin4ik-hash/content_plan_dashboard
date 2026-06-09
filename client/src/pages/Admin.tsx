import { useState } from "react";
import {
  Loader2,
  Search,
  Trash2,
  Plus,
  Minus,
  Calendar,
  Crown,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";

/* ============================================================
   /admin — панель администратора. Видна только при role="admin".
   Список юзеров с инлайн-кнопками: +1000 токенов / -1000 токенов /
   продлить триал на 30 дней / сделать pro / удалить.

   Назначение админов — через env-секрет ADMIN_EMAILS (CSV).
   В БД ничего не хранится, поэтому ничего тут «отозвать» нельзя:
   достаточно убрать email из секрета.
   ============================================================ */
export default function Admin() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const stats = trpc.admin.stats.useQuery(undefined, { enabled: !!user });
  const users = trpc.admin.listUsers.useQuery(
    { search: search.trim() || undefined, limit: 200 },
    { enabled: !!user },
  );

  /* role-guard на клиенте — серверный adminProcedure всё равно
     отдаст FORBIDDEN, это просто чтобы не показывать кнопки
     обычному юзеру, который случайно зашёл по URL. */
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen" style={{ background: "var(--background)" }}>
        <section style={{ padding: "80px 0" }}>
          <div className="container" style={{ maxWidth: 560, textAlign: "center" }}>
            <h1 style={{ fontSize: 32, marginBottom: 12 }}>404</h1>
            <p className="text-platinum">Страница не найдена.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <section style={{ padding: "48px 0 16px" }}>
        <div className="container" style={{ maxWidth: 1180 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            <Crown
              className="w-3.5 h-3.5"
              style={{ display: "inline", marginRight: 6 }}
            />
            Админ-панель
          </div>
          <h1 style={{ letterSpacing: "-0.8px", marginBottom: 12 }}>
            Пользователи и{" "}
            <span style={{ color: "var(--brand-gold)" }}>биллинг</span>
          </h1>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: "0 0 16px" }}>
        <div
          className="container"
          style={{
            maxWidth: 1180,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          <StatCard
            label="Всего юзеров"
            value={stats.data?.totalUsers ?? "—"}
          />
          <StatCard
            label="Активный триал"
            value={stats.data?.activeTrials ?? "—"}
          />
          <StatCard label="Платный план" value={stats.data?.paidUsers ?? "—"} />
          <StatCard
            label="Токенов израсходовано"
            value={
              stats.data?.tokensUsedTotal != null
                ? stats.data.tokensUsedTotal.toLocaleString("ru-RU")
                : "—"
            }
          />
        </div>
      </section>

      {/* Search */}
      <section style={{ padding: "16px 0" }}>
        <div className="container" style={{ maxWidth: 1180 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 14px",
              background: "var(--ink-3)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              height: 44,
            }}
          >
            <Search className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по email или имени"
              style={{
                flex: 1,
                background: "transparent",
                border: 0,
                outline: "none",
                color: "#fff",
                fontSize: 14,
              }}
            />
          </label>
        </div>
      </section>

      {/* Users */}
      <section style={{ padding: "8px 0 96px" }}>
        <div className="container" style={{ maxWidth: 1180 }}>
          {users.isLoading ? (
            <div className="text-platinum" style={{ padding: 24 }}>
              <Loader2 className="w-4 h-4 animate-spin" style={{ display: "inline", marginRight: 8 }} />
              Загружаю...
            </div>
          ) : users.data && users.data.length > 0 ? (
            <div className="bento-card" style={{ padding: 0, overflow: "hidden" }}>
              <UsersTable
                rows={users.data}
                onChanged={() => {
                  users.refetch();
                  stats.refetch();
                }}
                selfId={user.id}
              />
            </div>
          ) : (
            <div className="text-platinum" style={{ padding: 24 }}>
              Юзеров пока нет.
            </div>
          )}
        </div>
      </section>

      {/* Диагностика почты — проверка, что Resend реально доставляет
          письма (sandbox-режим отдаёт 200, но молча роняет на чужие
          адреса; верифицированный домен — доставляет всем). */}
      <section style={{ padding: "0 0 96px" }}>
        <div className="container" style={{ maxWidth: 1180 }}>
          <EmailDiagnostics />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bento-card" style={{ padding: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 6, fontSize: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>
        {value}
      </div>
    </div>
  );
}

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  createdAt: number;
  trialEndsAt: number;
  tokensRemaining: number;
  tokensUsedTotal: number;
};

function UsersTable({
  rows,
  onChanged,
  selfId,
}: {
  rows: UserRow[];
  onChanged: () => void;
  selfId: string;
}) {
  const update = trpc.admin.updateUser.useMutation({
    onSuccess: () => {
      toast.success("Сохранено");
      onChanged();
    },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("Юзер удалён");
      onChanged();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ background: "var(--ink-2)" }}>
          <Th>Email / имя</Th>
          <Th>План</Th>
          <Th>Триал до</Th>
          <Th>Токены</Th>
          <Th>Использовал</Th>
          <Th>Действия</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((u) => {
          const trialDate = new Date(u.trialEndsAt);
          const expired = u.trialEndsAt < Date.now();
          const isSelf = u.id === selfId;
          return (
            <tr
              key={u.id}
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <Td>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ color: "#fff", fontWeight: 600 }}>
                    {u.email}
                    {isSelf && (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: "2px 6px",
                          background: "rgba(212,168,67,0.18)",
                          color: "var(--brand-gold)",
                          fontSize: 10,
                          fontWeight: 700,
                          borderRadius: 6,
                          textTransform: "uppercase",
                        }}
                      >
                        ты
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      color: "var(--muted-foreground)",
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    {u.name ?? "—"}
                  </span>
                </div>
              </Td>
              <Td>
                <select
                  value={u.plan}
                  onChange={(e) =>
                    update.mutate({
                      id: u.id,
                      plan: e.target.value as "trial" | "pro" | "team",
                    })
                  }
                  style={selectStyle}
                >
                  <option value="trial">Триал</option>
                  <option value="pro">Pro</option>
                  <option value="team">Team</option>
                </select>
              </Td>
              <Td>
                <span style={{ color: expired ? "#f87171" : "#fff" }}>
                  {trialDate.toLocaleDateString("ru-RU")}
                </span>
                <button
                  onClick={() => update.mutate({ id: u.id, trialDays: 30 })}
                  title="Продлить триал на 30 дней"
                  style={{ ...iconBtnStyle, marginLeft: 6 }}
                >
                  <Calendar className="w-3.5 h-3.5" />
                </button>
              </Td>
              <Td>
                <span style={{ color: "#fff", fontWeight: 600 }}>
                  {u.tokensRemaining.toLocaleString("ru-RU")}
                </span>
                <div style={{ display: "inline-flex", gap: 4, marginLeft: 8 }}>
                  <button
                    onClick={() =>
                      update.mutate({ id: u.id, tokensDelta: 1_000 })
                    }
                    title="+1 000 токенов"
                    style={iconBtnStyle}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      update.mutate({ id: u.id, tokensDelta: -1_000 })
                    }
                    title="-1 000 токенов"
                    style={iconBtnStyle}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <SetTokensButton
                    onSet={(v) => update.mutate({ id: u.id, setTokens: v })}
                  />
                </div>
              </Td>
              <Td>{u.tokensUsedTotal.toLocaleString("ru-RU")}</Td>
              <Td>
                {!isSelf && (
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Удалить ${u.email}? Это действие необратимо.`,
                        )
                      ) {
                        del.mutate({ id: u.id });
                      }
                    }}
                    title="Удалить юзера"
                    style={{ ...iconBtnStyle, color: "#f87171" }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SetTokensButton({ onSet }: { onSet: (v: number) => void }) {
  return (
    <button
      onClick={() => {
        const raw = window.prompt(
          "Выставить баланс токенов (точная цифра):",
          "10000",
        );
        if (!raw) return;
        const n = parseInt(raw.replace(/\D/g, ""), 10);
        if (!Number.isFinite(n) || n < 0) return;
        onSet(n);
      }}
      title="Выставить точный баланс"
      style={iconBtnStyle}
    >
      <Save className="w-3.5 h-3.5" />
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 14px",
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        color: "var(--muted-foreground)",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "12px 14px", color: "var(--brand-platinum)" }}>
      {children}
    </td>
  );
}

const selectStyle: React.CSSProperties = {
  background: "var(--ink-2)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
  cursor: "pointer",
};

const iconBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 8,
  background: "var(--ink-2)",
  border: 0,
  color: "var(--brand-platinum)",
  cursor: "pointer",
};

/* Карточка диагностики почты: вводишь email → жмёшь «Отправить тест»
   → ниже выводится сырой ответ Resend (id успешного письма или
   ошибка с кодом). Помогает определить корень проблем с verification /
   reset-password письмами. */
function EmailDiagnostics() {
  const [to, setTo] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const test = trpc.admin.testEmail.useMutation({
    onSuccess: (r) => setResult(r),
    onError: (e) => setResult({ ok: false, error: e.message }),
  });

  return (
    <div className="bento-card" style={{ padding: 24 }}>
      <div className="eyebrow" style={{ marginBottom: 12, color: "var(--brand-gold)" }}>
        Диагностика почты
      </div>
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#fff",
          margin: "0 0 12px",
          letterSpacing: "-0.2px",
        }}
      >
        Проверка отправки через Resend
      </h3>
      <p
        className="text-platinum"
        style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}
      >
        Отправит копию password-reset-письма на указанный адрес.
        Покажет реальный ответ Resend (id если успех, или текст ошибки).
        Если без верификации домена — sandbox принимает только email
        владельца Resend-аккаунта; на остальные молча роняет.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="кому отправить (email)"
          style={{
            flex: "1 1 240px",
            height: 40,
            padding: "0 14px",
            background: "var(--ink-3)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 9999,
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          onClick={() => {
            if (!to.trim()) return;
            setResult(null);
            test.mutate({ to: to.trim() });
          }}
          disabled={!to.trim() || test.isPending}
          className="btn-gold"
          style={{ padding: "10px 18px", fontSize: 13 }}
        >
          {test.isPending ? "Отправляю..." : "Отправить тест"}
        </button>
      </div>

      {result != null && (
        <pre
          style={{
            marginTop: 14,
            padding: 14,
            background: "var(--ink-3)",
            borderRadius: 10,
            fontFamily: "var(--font-body)",
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            color: (result as any).ok ? "#3ecf8e" : "#f87171",
            border: `1px solid ${(result as any).ok ? "rgba(62,207,142,0.3)" : "rgba(248,113,113,0.3)"}`,
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
