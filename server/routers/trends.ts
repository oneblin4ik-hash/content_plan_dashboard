import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { d1Query, d1Execute, isD1Configured } from "../_core/d1";
import { invokeLLM } from "../_core/llm";
import { SERBOLIN_SYSTEM_PROMPT } from "../_core/brand-knowledge";

/* ============================================================
   Trends router — каждый день парсит публичные превью-страницы
   t.me/s/<channel> конкурентов из фитнес-ниши, агрегирует тексты
   их популярных постов и просит Gemini выделить 5-7 трендовых
   тем под ЦА Эдуарда. Сохраняет в D1 (table trend_topics).

   Источник публичный — это HTML на t.me/s/<channel>, которое
   показывает ленту без логина. Никаких приватных API.
   ============================================================ */

/* Дефолтный список публичных TG-каналов фитнес/похудение ниши.
   Переопределяется через env-переменную TRENDS_CHANNELS (через запятую).
   Конкуренты из маркетингового отчёта (Nezozhnik, TuluPavel, Колсанова)
   живут в Instagram/YouTube, не в TG, поэтому используем тематически
   близкие публичные русскоязычные TG-каналы. */
const DEFAULT_CHANNELS = [
  "pohudenie_legko",
  "gymandfit",
  "tula_fitness",
  "sportexpert",
];

function getChannels(): string[] {
  const fromEnv = (process.env.TRENDS_CHANNELS ?? "").trim();
  if (!fromEnv) return DEFAULT_CHANNELS;
  return fromEnv
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

type RawPost = { channel: string; text: string };

/* Парсит публичный превью-канал и возвращает до N последних постов. */
async function fetchChannelPosts(channel: string, limit = 8): Promise<RawPost[]> {
  const url = `https://t.me/s/${channel}`;
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" },
    redirect: "follow",
  });
  if (!res.ok) return [];
  const html = await res.text();
  /* Telegram превью кладёт текст поста в <div class="tgme_widget_message_text ..."> */
  const re =
    /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  const out: RawPost[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < limit) {
    const text = m[1]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
    if (text.length > 40) out.push({ channel, text: text.slice(0, 800) });
  }
  return out;
}

type TrendTopic = {
  title: string;
  summary: string;
  why_viral: string;
  example_excerpts: string[];
};

async function clusterTopics(posts: RawPost[]): Promise<TrendTopic[]> {
  /* Собираем ленту в один промпт. 30 постов × 800 знаков ≈ 24k символов —
     влезает в context Gemini 2.5 Flash с запасом. */
  const corpus = posts
    .map((p, i) => `[${i + 1}] @${p.channel}\n${p.text}`)
    .join("\n\n---\n\n");

  const system = `${SERBOLIN_SYSTEM_PROMPT}

Текущая задача: проанализировать ниже корпус постов из публичных Telegram-каналов
конкурентов в фитнес-нише и выделить 5-7 ТРЕНДОВЫХ ТЕМ, которые с большой
вероятностью зайдут на аудиторию Эдуарда (женщины 25-45, мужчины 30-45).
Темы должны быть конкретные, не размытые («ягодицы дома без оборудования»,
а не «спорт и здоровье»). Для каждой темы дай:
- title — 4-8 слов, цепляющий
- summary — 1-2 предложения, о чём писать
- why_viral — почему сейчас зайдёт (опирайся на боль ЦА)
- example_excerpts — 1-2 коротких цитаты (до 80 символов каждая) из корпуса`;

  const user = `КОРПУС ПОСТОВ КОНКУРЕНТОВ:

${corpus}

Выдай результат строго в JSON без обёрток markdown:
{
  "topics": [
    {
      "title": "...",
      "summary": "...",
      "why_viral": "...",
      "example_excerpts": ["...", "..."]
    }
  ]
}`;

  const r = await invokeLLM({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const raw = r.choices[0]?.message.content;
  if (typeof raw !== "string") throw new Error("LLM пустой ответ");
  const cleaned = raw
    .replace(/^```(json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as { topics: TrendTopic[] };
    return parsed.topics ?? [];
  } catch {
    throw new Error(`LLM вернул не-JSON: ${cleaned.slice(0, 200)}`);
  }
}

export async function runTrendsRefresh(): Promise<{
  topics: number;
  posts: number;
}> {
  if (!isD1Configured()) throw new Error("D1 не настроен");

  const logId = crypto.randomUUID();
  const startedAt = Date.now();
  await d1Execute(
    "INSERT INTO trend_refresh_log (id, started_at, status, topics_count) VALUES (?, ?, 'started', 0)",
    [logId, startedAt],
  );

  try {
    /* 1. Собираем посты со всех каналов параллельно */
    const channels = getChannels();
    const allPosts = (
      await Promise.all(channels.map((c) => fetchChannelPosts(c, 8)))
    ).flat();

    if (allPosts.length < 5) {
      throw new Error(
        `Слишком мало постов собрано (${allPosts.length}). Проверь, что каналы в TRENDS_CHANNELS публичные и существуют: ${channels.join(", ")}`,
      );
    }

    /* 2. Кластеризуем через Gemini */
    const topics = await clusterTopics(allPosts);

    /* 3. Перезаписываем таблицу (свежие тренды важнее истории) */
    await d1Execute("DELETE FROM trend_topics", []);
    const now = Date.now();
    for (const t of topics) {
      await d1Execute(
        "INSERT INTO trend_topics (id, title, summary, why_viral, source_channels, examples_json, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          crypto.randomUUID(),
          t.title,
          t.summary,
          t.why_viral,
          channels.join(","),
          JSON.stringify(t.example_excerpts ?? []),
          now,
        ],
      );
    }

    await d1Execute(
      "UPDATE trend_refresh_log SET finished_at = ?, status = 'ok', topics_count = ? WHERE id = ?",
      [Date.now(), topics.length, logId],
    );

    return { topics: topics.length, posts: allPosts.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await d1Execute(
      "UPDATE trend_refresh_log SET finished_at = ?, status = 'error', error_text = ? WHERE id = ?",
      [Date.now(), msg.slice(0, 500), logId],
    );
    throw err;
  }
}

export const trendsRouter = router({
  list: publicProcedure.query(async () => {
    if (!isD1Configured()) return { topics: [], lastRefreshedAt: null };
    const rows = await d1Query<{
      id: string;
      title: string;
      summary: string;
      why_viral: string;
      source_channels: string;
      examples_json: string;
      fetched_at: number;
    }>(
      "SELECT id, title, summary, why_viral, source_channels, examples_json, fetched_at FROM trend_topics ORDER BY fetched_at DESC LIMIT 20",
      [],
    );
    return {
      topics: rows.map((r) => ({
        id: r.id,
        title: r.title,
        summary: r.summary,
        whyViral: r.why_viral,
        sourceChannels: r.source_channels.split(","),
        examples: JSON.parse(r.examples_json) as string[],
        fetchedAt: r.fetched_at,
      })),
      lastRefreshedAt: rows[0]?.fetched_at ?? null,
    };
  }),

  refresh: publicProcedure
    .input(z.object({}).optional())
    .mutation(async () => {
      const result = await runTrendsRefresh();
      return { ok: true, ...result };
    }),

  channels: publicProcedure.query(() => ({
    channels: getChannels(),
  })),
});
