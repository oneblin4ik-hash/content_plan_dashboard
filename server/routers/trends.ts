import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { d1Query, d1Execute, d1Batch, isD1Configured } from "../_core/d1";
import { invokeLLM } from "../_core/llm";
import { SERBOLIN_SYSTEM_PROMPT } from "../_core/brand-knowledge";

/* ============================================================
   Trends router — каждый день парсит публичные превью-страницы
   t.me/s/<channel> ~50 публичных русскоязычных фитнес-каналов,
   агрегирует тексты их популярных постов и просит Gemini выделить
   5-7 трендовых тем под ЦА Эдуарда.

   Каналы хранятся в D1.trend_channels: системно-общая таблица.
   Список засеивается DEFAULT_CHANNELS при первом запуске, после
   этого пользователь может добавлять/выключать каналы через UI.
   Парсинг устойчив к мёртвым каналам: они получают status='empty'
   или 'http_error', но не валят всё обновление.

   Источник публичный — это HTML на t.me/s/<channel>, которое
   показывает ленту без логина. Никаких приватных API.
   ============================================================ */

/* Стартовый набор ~50 каналов в русскоязычной фитнес-нише:
   тренеры, питание, женский/мужской фитнес, бодибилдинг, кроссфит,
   реабилитация, йога/пилатес, медицина спорта. Не все из них могут
   быть живыми — парсер пропустит мёртвые, в UI будет видно. */
const DEFAULT_CHANNELS = [
  // фитнес-тренеры / общая ниша
  "bombatelo", "gymandfit", "fittingsuit", "sportexpert", "fitness_pro_ru",
  "anatolygolovan", "stogniyfit", "tula_fitness", "trenertyt", "fitmolot",
  // похудение / женская аудитория
  "pohudenie_legko", "figura_idealu", "fitness_dlya_devushek",
  "irinakomarova_fitness", "fit_mama", "ladyform", "mojfitnes",
  "ya_fitness", "iznutrishka", "bestyourself_pro",
  // питание / нутрициология
  "nutricialovers", "zdorov_fit", "zdorovoeschoo", "dr_dyukan",
  "fmcandyk", "iznutrishka_nutrition",
  // бодибилдинг / силовая
  "mtmuscle", "ironclub_russia", "bodybuilding_ru", "powerlifting_ru",
  "kachok_kanal",
  // кроссфит / hiit / функционалка
  "crossfit_russia", "functional_training_ru", "hiit_workout_ru",
  // йога / пилатес / стретчинг
  "yoga_russia", "pilatesrus", "stretching_pro",
  // реабилитация / здоровье спины
  "reha_sport", "back_school_ru", "kinesio_pro",
  // спорт-медиа и блогеры
  "sportium", "baseguru", "sportwiki", "lavkalifestyle",
  "fitness_secrets_pro", "fitnesnews", "mariannar", "sportlife_russia",
  "bro_fitness", "WomensHealthRus", "MensHealthRus",
];

type RawPost = { channel: string; text: string };
type FetchResult = {
  channel: string;
  posts: RawPost[];
  status: "ok" | "empty" | "http_error" | "fetch_error";
  error?: string;
};

/* Парсит публичный превью-канал и возвращает до N последних постов
   плюс статус для UI. Устойчив к 404 и сетевым ошибкам. */
async function fetchChannelPosts(
  channel: string,
  limit = 6,
): Promise<FetchResult> {
  const url = `https://t.me/s/${channel}`;
  let res: Response;
  try {
    /* redirect: "manual" — Telegram редиректит /s/<channel> на /<channel>
       для несуществующих/непубличных каналов. Каждый редирект в follow-
       режиме тратит CF-subrequest, что быстро упирает в лимит при
       парсинге десятков каналов. С manual: 302/301 = «канал недоступен
       публично», просто маркируем как http_error и идём дальше. */
    res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (content-studio trends)" },
      redirect: "manual",
    });
  } catch (e) {
    return {
      channel,
      posts: [],
      status: "fetch_error",
      error: e instanceof Error ? e.message.slice(0, 200) : String(e),
    };
  }
  /* 302/301 — Telegram отказался отдавать публичную ленту (приватный
     канал или несуществующий username). 4xx/5xx — тоже мимо. */
  if (res.status !== 200) {
    return {
      channel,
      posts: [],
      status: "http_error",
      error: `HTTP ${res.status}`,
    };
  }
  const html = await res.text();
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
  return {
    channel,
    posts: out,
    status: out.length > 0 ? "ok" : "empty",
  };
}

/* Запускает fetch'и батчами по `concurrency`, чтобы не упереться в
   лимит CF Worker (50 subrequests на воркер-инвокацию). */
async function fetchAllChannels(
  channels: string[],
  concurrency = 10,
): Promise<FetchResult[]> {
  const results: FetchResult[] = [];
  for (let i = 0; i < channels.length; i += concurrency) {
    const batch = channels.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((c) => fetchChannelPosts(c)));
    results.push(...batchResults);
  }
  return results;
}

async function seedChannelsIfEmpty(): Promise<void> {
  const existing = await d1Query<{ name: string }>(
    "SELECT name FROM trend_channels LIMIT 1",
    [],
  );
  if (existing.length > 0) return;
  const now = Date.now();
  /* Через batch, чтобы уложиться в subrequest-лимит (50 INSERT'ов
     по одному = 50 subrequests; одна batch-операция = 1 subrequest). */
  await d1Batch(
    DEFAULT_CHANNELS.map((name) => ({
      sql:
        "INSERT OR IGNORE INTO trend_channels (name, enabled, status, last_post_count, added_at) VALUES (?, 1, 'unknown', 0, ?)",
      params: [name, now],
    })),
  );
}

/* CF Workers free-tier лимит 50 subrequests на инвокацию. Парсинг
   одного канала = 1 fetch. Плюс LLM-call (1-3 subrequests с retry/
   fallback на 2.5). Итого можно безопасно парсить ~40 каналов за раз.
   Для остальных приходим в следующем cron-прогоне — порядок выбора
   ротационный: те, у которых last_fetched_at старше, идут первыми. */
/* На free-tier CF Workers лимит 50 subrequests на инвокацию.
   С redirect: "manual" каждый канал = ровно 1 fetch. Плюс LLM (1-3
   subrequests с retry/fallback) и небольшой запас. Парсим до 45
   каналов за прогон. */
const PARSE_LIMIT_PER_RUN = 45;

async function listEnabledChannelNames(): Promise<string[]> {
  if (!isD1Configured()) return DEFAULT_CHANNELS.slice(0, PARSE_LIMIT_PER_RUN);
  await seedChannelsIfEmpty();
  const rows = await d1Query<{ name: string }>(
    "SELECT name FROM trend_channels WHERE enabled = 1 ORDER BY COALESCE(last_fetched_at, 0) ASC, name ASC LIMIT ?",
    [PARSE_LIMIT_PER_RUN],
  );
  return rows.map((r) => r.name);
}

type TrendTopic = {
  title: string;
  summary: string;
  why_viral: string;
  example_excerpts: string[];
};

async function clusterTopics(posts: RawPost[]): Promise<TrendTopic[]> {
  /* 50 каналов × 6 постов × ~800 знаков ≈ 240k символов — слишком много
     даже для Gemini. Берём топ-2 поста с каждого канала и режем
     каждый до 500 символов — это даёт ~100k знаков на промпт. */
  const byChannel = new Map<string, RawPost[]>();
  for (const p of posts) {
    const arr = byChannel.get(p.channel) ?? [];
    if (arr.length < 2) {
      arr.push({ ...p, text: p.text.slice(0, 500) });
      byChannel.set(p.channel, arr);
    }
  }
  const trimmed = Array.from(byChannel.values()).flat();
  const corpus = trimmed
    .map((p, i) => `[${i + 1}] @${p.channel}\n${p.text}`)
    .join("\n\n---\n\n");

  const system = `${SERBOLIN_SYSTEM_PROMPT}

Текущая задача: проанализировать ниже корпус постов из публичных Telegram-каналов
конкурентов в фитнес-нише и выделить 5-8 ТРЕНДОВЫХ ТЕМ, которые с большой
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
  channelsOk: number;
  channelsTotal: number;
}> {
  if (!isD1Configured()) throw new Error("D1 не настроен");

  const logId = crypto.randomUUID();
  const startedAt = Date.now();
  await d1Execute(
    "INSERT INTO trend_refresh_log (id, started_at, status, topics_count) VALUES (?, ?, 'started', 0)",
    [logId, startedAt],
  );

  try {
    /* 1. Собираем посты со всех активных каналов параллельными батчами. */
    const channels = await listEnabledChannelNames();
    const results = await fetchAllChannels(channels, 10);

    /* 2. Сохраняем статус каждого канала одним batch (1 subrequest
       вместо 50, чтобы влезть в free-tier лимит CF Workers). */
    const now = Date.now();
    await d1Batch(
      results.map((r) => ({
        sql: "UPDATE trend_channels SET status = ?, last_post_count = ?, last_fetched_at = ?, last_error = ? WHERE name = ?",
        params: [r.status, r.posts.length, now, r.error ?? null, r.channel],
      })),
    );

    const allPosts = results.flatMap((r) => r.posts);
    const channelsOk = results.filter((r) => r.status === "ok").length;

    if (allPosts.length < 5) {
      throw new Error(
        `Слишком мало постов собрано (${allPosts.length}) из ${channels.length} каналов. Большинство каналов не отдали ленту — проверь, что они существуют в Telegram и не приватные.`,
      );
    }

    /* 3. Кластеризуем через Gemini */
    const topics = await clusterTopics(allPosts);

    /* 4. Перезаписываем таблицу одним batch (DELETE + N INSERT).
       Свежие тренды важнее истории; история живёт только до следующего
       обновления. */
    const okChannelNames = results
      .filter((r) => r.status === "ok")
      .map((r) => r.channel)
      .join(",");
    await d1Batch([
      { sql: "DELETE FROM trend_topics", params: [] },
      ...topics.map((t) => ({
        sql:
          "INSERT INTO trend_topics (id, title, summary, why_viral, source_channels, examples_json, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        params: [
          crypto.randomUUID(),
          t.title,
          t.summary,
          t.why_viral,
          okChannelNames,
          JSON.stringify(t.example_excerpts ?? []),
          now,
        ],
      })),
    ]);

    await d1Execute(
      "UPDATE trend_refresh_log SET finished_at = ?, status = 'ok', topics_count = ? WHERE id = ?",
      [Date.now(), topics.length, logId],
    );

    return {
      topics: topics.length,
      posts: allPosts.length,
      channelsOk,
      channelsTotal: channels.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await d1Execute(
      "UPDATE trend_refresh_log SET finished_at = ?, status = 'error', error_text = ? WHERE id = ?",
      [Date.now(), msg.slice(0, 500), logId],
    );
    throw err;
  }
}

const channelNameSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_]+$/, "Только латиница, цифры и подчёркивания (имя без @ и https)");

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
        sourceChannels: r.source_channels ? r.source_channels.split(",") : [],
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

  channels: publicProcedure.query(async () => {
    if (!isD1Configured()) {
      return DEFAULT_CHANNELS.map((name) => ({
        name,
        enabled: true,
        status: "unknown" as const,
        lastPostCount: 0,
        lastFetchedAt: null as number | null,
        lastError: null as string | null,
      }));
    }
    await seedChannelsIfEmpty();
    const rows = await d1Query<{
      name: string;
      enabled: number;
      status: string;
      last_post_count: number;
      last_fetched_at: number | null;
      last_error: string | null;
    }>(
      "SELECT name, enabled, status, last_post_count, last_fetched_at, last_error FROM trend_channels ORDER BY enabled DESC, last_post_count DESC, name ASC",
      [],
    );
    return rows.map((r) => ({
      name: r.name,
      enabled: r.enabled === 1,
      status: r.status,
      lastPostCount: r.last_post_count,
      lastFetchedAt: r.last_fetched_at,
      lastError: r.last_error,
    }));
  }),

  addChannel: publicProcedure
    .input(z.object({ name: channelNameSchema }))
    .mutation(async ({ input }) => {
      await d1Execute(
        "INSERT OR IGNORE INTO trend_channels (name, enabled, status, last_post_count, added_at) VALUES (?, 1, 'unknown', 0, ?)",
        [input.name, Date.now()],
      );
      /* Сразу пробуем сделать первый fetch — пользователь увидит,
         реально ли канал отдаёт посты. */
      const r = await fetchChannelPosts(input.name);
      await d1Execute(
        "UPDATE trend_channels SET status = ?, last_post_count = ?, last_fetched_at = ?, last_error = ? WHERE name = ?",
        [r.status, r.posts.length, Date.now(), r.error ?? null, input.name],
      );
      return { ok: true, status: r.status, postCount: r.posts.length };
    }),

  setEnabled: publicProcedure
    .input(z.object({ name: channelNameSchema, enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      await d1Execute(
        "UPDATE trend_channels SET enabled = ? WHERE name = ?",
        [input.enabled ? 1 : 0, input.name],
      );
      return { ok: true };
    }),

  removeChannel: publicProcedure
    .input(z.object({ name: channelNameSchema }))
    .mutation(async ({ input }) => {
      await d1Execute("DELETE FROM trend_channels WHERE name = ?", [input.name]);
      return { ok: true };
    }),
});
