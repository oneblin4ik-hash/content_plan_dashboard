import { useEffect, useState } from "react";
import { Loader2, Save, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/* ============================================================
   /voice — настройка персонального голоса. Поля простые:
   имя/ниша/ЦА/обращение/эмодзи/любимые обороты/запрещённые слова/CTA.
   Серверная функция buildSystemPrompt(voice) собирает из этого
   персональный блок поверх универсального FITNESS_BASE_SYSTEM.

   Параллельно у юзера может работать автоанализ его публичного TG-
   канала (раздел /integrations) — он даёт более тонкий voice profile,
   эта страница описывает базовые правила «руками».
   ============================================================ */
type VoiceForm = {
  personaName: string;
  bio: string;
  niche: string;
  audience: string;
  address: "ты" | "вы";
  emojiStyle: "none" | "light" | "moderate" | "rich";
  signaturePhrases: string;
  forbiddenWords: string;
  defaultCta: string;
};

const EMPTY: VoiceForm = {
  personaName: "",
  bio: "",
  niche: "",
  audience: "",
  address: "ты",
  emojiStyle: "moderate",
  signaturePhrases: "",
  forbiddenWords: "",
  defaultCta: "",
};

export default function Voice() {
  const voiceQuery = trpc.voice.get.useQuery();
  const updateMutation = trpc.voice.update.useMutation({
    onSuccess: () => {
      voiceQuery.refetch();
      toast.success("Голос обновлён. Применится со следующей генерации.");
    },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<VoiceForm>(EMPTY);

  useEffect(() => {
    const v = voiceQuery.data;
    if (!v) return;
    setForm({
      personaName: v.personaName ?? "",
      bio: v.bio ?? "",
      niche: v.niche ?? "",
      audience: v.audience ?? "",
      address: v.address ?? "ты",
      emojiStyle: v.emojiStyle ?? "moderate",
      signaturePhrases: (v.signaturePhrases ?? []).join("\n"),
      forbiddenWords: (v.forbiddenWords ?? []).join(", "),
      defaultCta: v.defaultCta ?? "",
    });
  }, [voiceQuery.data]);

  const onSave = () => {
    updateMutation.mutate({
      personaName: form.personaName,
      bio: form.bio,
      niche: form.niche,
      audience: form.audience,
      address: form.address,
      emojiStyle: form.emojiStyle,
      signaturePhrases: form.signaturePhrases
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      forbiddenWords: form.forbiddenWords
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      defaultCta: form.defaultCta,
    });
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <section style={{ padding: "48px 0 16px" }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            <MessageCircle
              className="w-3.5 h-3.5"
              style={{ display: "inline", marginRight: 6 }}
            />
            Голос бренда
          </div>
          <h1 style={{ letterSpacing: "-0.8px", marginBottom: 12 }}>
            Настрой,{" "}
            <span style={{ color: "var(--brand-gold)" }}>как ИИ пишет</span>{" "}
            от твоего имени.
          </h1>
          <p
            className="text-platinum"
            style={{ maxWidth: 640, fontSize: 16, marginBottom: 28 }}
          >
            Эти настройки применяются ко всем генерациям в Студии и
            Каруселях. Чем точнее заполнишь — тем сильнее тексты будут
            похожи на твои собственные.
          </p>
        </div>
      </section>

      <section style={{ padding: "8px 0 96px" }}>
        <div className="container" style={{ maxWidth: 820 }}>
          {voiceQuery.isLoading ? (
            <div
              className="text-platinum"
              style={{ fontSize: 14, padding: 24 }}
            >
              <Loader2
                className="w-4 h-4 animate-spin"
                style={{ display: "inline", marginRight: 8 }}
              />
              Загружаю...
            </div>
          ) : (
            <div className="bento-card" style={{ padding: 28, display: "grid", gap: 18 }}>
              <Row>
                <Field label="Имя автора / бренд">
                  <Inp
                    value={form.personaName}
                    onChange={(v) => setForm({ ...form, personaName: v })}
                    placeholder="Иван Петров / FitWithMe / @your_handle"
                  />
                </Field>
                <Field label="Ниша">
                  <Inp
                    value={form.niche}
                    onChange={(v) => setForm({ ...form, niche: v })}
                    placeholder="похудение для женщин / силовой тренинг / йога"
                  />
                </Field>
              </Row>

              <Field label="Краткое позиционирование (1-2 предложения)">
                <Area
                  rows={2}
                  value={form.bio}
                  onChange={(v) => setForm({ ...form, bio: v })}
                  placeholder="Тренер с 5-летним стажем, специализация — реабилитация после родов."
                />
              </Field>

              <Field label="Целевая аудитория">
                <Area
                  rows={2}
                  value={form.audience}
                  onChange={(v) => setForm({ ...form, audience: v })}
                  placeholder="Женщины 28-40, после родов, нет времени на зал, хотят вернуть форму."
                />
              </Field>

              <Row>
                <Field label="Обращение к аудитории">
                  <ChipRow
                    options={[
                      { v: "ты", label: "На «ты»" },
                      { v: "вы", label: "На «вы»" },
                    ]}
                    value={form.address}
                    onChange={(v) =>
                      setForm({ ...form, address: v as "ты" | "вы" })
                    }
                  />
                </Field>
                <Field label="Стиль эмодзи">
                  <ChipRow
                    options={[
                      { v: "none", label: "Без" },
                      { v: "light", label: "Редко" },
                      { v: "moderate", label: "В меру" },
                      { v: "rich", label: "Часто" },
                    ]}
                    value={form.emojiStyle}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        emojiStyle: v as VoiceForm["emojiStyle"],
                      })
                    }
                  />
                </Field>
              </Row>

              <Field label="Любимые обороты автора (по одной фразе на строку)">
                <Area
                  rows={3}
                  value={form.signaturePhrases}
                  onChange={(v) => setForm({ ...form, signaturePhrases: v })}
                  placeholder={
                    "Например:\nза руку приведу к результату\nне нужно потеть три часа в зале"
                  }
                />
              </Field>

              <Field label="Запрещённые слова (через запятую или с новой строки)">
                <Area
                  rows={2}
                  value={form.forbiddenWords}
                  onChange={(v) => setForm({ ...form, forbiddenWords: v })}
                  placeholder="детка, подруга, пупсик"
                />
              </Field>

              <Field label="Стандартный CTA">
                <Inp
                  value={form.defaultCta}
                  onChange={(v) => setForm({ ...form, defaultCta: v })}
                  placeholder="Напиши в директ слово «РАЗБОР» — пришлю план"
                />
              </Field>

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={onSave}
                  disabled={updateMutation.isPending}
                  className="btn-gold"
                  style={{ padding: "12px 22px", fontSize: 14 }}
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Сохраняю...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Сохранить
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 18,
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8, fontSize: 10 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Inp({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        height: 44,
        padding: "0 14px",
        background: "var(--ink-3)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        fontSize: 14,
        fontFamily: "var(--font-body)",
      }}
    />
  );
}

function Area({
  value,
  onChange,
  rows,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: 14,
        background: "var(--ink-3)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        fontSize: 14,
        fontFamily: "var(--font-body)",
        lineHeight: 1.5,
        resize: "vertical",
      }}
    />
  );
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: { v: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          style={{
            padding: "9px 14px",
            borderRadius: 9999,
            border: 0,
            background:
              value === o.v ? "var(--brand-gold)" : "var(--ink-2)",
            color: value === o.v ? "var(--ink)" : "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
