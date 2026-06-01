import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { d1Query, d1Execute, d1Batch, isD1Configured } from "../_core/d1";
import { invokeRawForUser } from "../_core/llm-guard";
import { FITNESS_BASE_SYSTEM } from "../_core/voice-config";
import type { AuthUser } from "../_core/context";

/* ============================================================
   Competitor analysis — фитнес-вертикаль.
   Парсит публичные TG-каналы и YouTube-каналы конкурентов, кэширует
   набор последних постов/видео, для каждого канала просит Gemini
   выдать структурированный отчёт: что работает в нише, какие приёмы
   использует автор, и как это применить в своём контенте.

   Источники:
   - Telegram: HTML на t.me/s/<channel> (та же логика что в trends/
     integrations, но с расширенным сбором подписчиков/просмотров).
   - YouTube: HTML страницы youtube.com/@handle. Парсим title видео,
     описание, частоту, без приватных API. Просмотры извлекаются из
     ytInitialData (хрупко, но не требует ключа).

   Системно-общая таблица (без workspace_key) — конкуренты у всех
   пользователей в нише одни и те же.
   ============================================================ */

/* Дефолтные конкуренты для seed'инга. Telegram-имена — те, которые
   уже подтвердились в trends как живые. YouTube — известные русско-
   язычные фитнес-блогеры; если HTML ломается, статус будет dead. */
const DEFAULT_COMPETITORS: Array<{ platform: "tg" | "yt"; handle: string }> = [
  // Telegram — реально работающие из проверки trends
  { platform: "tg", handle: "kachok_kanal" },
  { platform: "tg", handle: "pohudenie_legko" },
  { platform: "tg", handle: "tula_fitness" },
  { platform: "tg", handle: "sportexpert" },
  { platform: "tg", handle: "fit_mama" },
  { platform: "tg", handle: "fitness_dlya_devushek" },
  { platform: "tg", handle: "gymandfit" },
  { platform: "tg", handle: "trenertyt" },
  // YouTube-каналы фитнес-блогеров (известные имена; если HTML ломается —
  // помечаем dead и пользователь добавляет свои через UI)
  { platform: "yt", handle: "denisgusev" },
  { platform: "yt", handle: "yfgym" },
  { platform: "yt", handle: "alexbodyfit" },
  { platform: "yt", handle: "vlad_vasilenkov" },
  { platform: "yt", handle: "smartfitsystem" },
];

type SamplePost = {
  text: string;
  views?: number;
  url?: string;
  publishedAt?: string;
};

type SyncResult = {
  title?: string;
  subscribers?: number;
  avgViews?: number;
  bio?: string;
  posts: SamplePost[];
  status: "ok" | "empty" | "http_error" | "fetch_error";
  error?: string;
};

/* ------- Telegram парсер (расширенная версия из integrations.ts). ------- */
async function syncTelegram(handle: string): Promise<SyncResult> {
  const url = `https://t.me/s/${handle}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (content-studio competitors)" },
      redirect: "manual",
    });
  } catch (e) {
    return {
      posts: [],
      status: "fetch_error",
      error: e instanceof Error ? e.message.slice(0, 200) : String(e),
    };
  }
  if (res.status !== 200) {
    return { posts: [], status: "http_error", error: `HTTP ${res.status}` };
  }
  const html = await res.text();

  /* Подписчики — через precise селектор. Telegram кладёт в
     <div class="tgme_channel_info_counter">
       <span class="counter_value">238</span>
       <span class="counter_type">subscribers</span>
     </div>
     Берём первое попадание counter_value с подписчиками. */
  let subscribers: number | undefined;
  const counterRe =
    /<span class="counter_value"[^>]*>([\d\s,.]+\s*[KMkmМт]?)\s*<\/span>\s*<span class="counter_type"[^>]*>(subscribers|members|подписчиков|подписчик|подписчика)<\/span>/i;
  const subM = html.match(counterRe);
  if (subM) {
    const raw = subM[1].replace(/\s/g, "");
    const num = parseFloat(raw.replace(/[KMkmМт]/g, "").replace(",", "."));
    if (!Number.isNaN(num)) {
      if (/[KkК]$/.test(raw)) subscribers = Math.round(num * 1000);
      else if (/[MmМ]$/.test(raw)) subscribers = Math.round(num * 1_000_000);
      else subscribers = Math.round(num);
    }
  }

  /* Title и bio */
  const titleMatch = html.match(
    /tgme_channel_info_header_title[^>]*>([\s\S]*?)<\/div>/i,
  );
  const title = titleMatch
    ? titleMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 120)
    : undefined;
  const bioMatch = html.match(
    /tgme_channel_info_description[^>]*>([\s\S]*?)<\/div>/i,
  );
  const bio = bioMatch
    ? bioMatch[1]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .trim()
        .slice(0, 500) || undefined
    : undefined;

  /* Парсим тексты постов и просмотры через два независимых regex,
     потом сопоставляем по порядку (по позиции в HTML). Это надёжнее
     чем монолитный блочный regex. */
  const textRe =
    /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  const viewsRe = /tgme_widget_message_views[^>]*>([^<]+)<\/span>/g;

  const texts: string[] = [];
  let tm: RegExpExecArray | null;
  while ((tm = textRe.exec(html)) !== null && texts.length < 15) {
    const text = tm[1]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
    if (text.length >= 30) texts.push(text.slice(0, 1500));
  }

  const viewsRaw: string[] = [];
  let vmm: RegExpExecArray | null;
  while ((vmm = viewsRe.exec(html)) !== null && viewsRaw.length < 15) {
    viewsRaw.push(vmm[1].trim());
  }

  const posts: SamplePost[] = texts.map((text, i) => {
    let views: number | undefined;
    const raw = viewsRaw[i];
    if (raw) {
      const num = parseFloat(raw.replace(/[, ]/g, ""));
      if (!Number.isNaN(num)) {
        if (/[KkК]$/.test(raw)) views = Math.round(num * 1000);
        else if (/[MmМ]$/.test(raw)) views = Math.round(num * 1_000_000);
        else views = Math.round(num) || undefined;
      }
    }
    return { text, views };
  });

  const viewsArr = posts.map((p) => p.views ?? 0).filter((v) => v > 0);
  const avgViews =
    viewsArr.length > 0
      ? Math.round(viewsArr.reduce((a, b) => a + b, 0) / viewsArr.length)
      : undefined;

  return {
    title,
    subscribers,
    avgViews,
    bio,
    posts,
    status: posts.length > 0 ? "ok" : "empty",
  };
}

/* ------- YouTube парсер (RSS feed, без API ключа). -------
   Шаг 1: resolve @handle → channel_id (UCxxx) через HTML страницы канала.
   Шаг 2: fetch RSS /feeds/videos.xml?channel_id=UCxxx — стабильный
   XML с title, link, description, опубликовано. Просмотры RSS НЕ
   возвращает — для них пришлось бы парсить каждое видео отдельно
   (дорого по subrequests). Оставляем без просмотров.

   Подписчики: из HTML канала (если запрос пройдёт) через
   "subscriberCountText".

   Итого на канал: 2 subrequest (HTML + RSS). 5 каналов = 10
   subrequests, что приемлемо в общем бюджете. */
async function syncYouTube(handle: string): Promise<SyncResult> {
  /* Шаг 1: HTML канала для resolution и подписчиков. */
  const channelUrl = `https://www.youtube.com/@${handle}`;
  let htmlRes: Response;
  try {
    htmlRes = await fetch(channelUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
  } catch (e) {
    return {
      posts: [],
      status: "fetch_error",
      error: e instanceof Error ? e.message.slice(0, 200) : String(e),
    };
  }
  if (!htmlRes.ok) {
    return {
      posts: [],
      status: "http_error",
      error: `HTTP ${htmlRes.status}`,
    };
  }
  const html = await htmlRes.text();

  /* Channel meta */
  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
  const title = titleMatch ? titleMatch[1].slice(0, 120) : undefined;
  const descMatch = html.match(
    /<meta property="og:description" content="([^"]+)"/,
  );
  const bio = descMatch ? descMatch[1].slice(0, 500) : undefined;

  /* Resolve channel_id (UCxxx) — обычно встречается в HTML несколько раз. */
  const channelIdMatch =
    html.match(/"externalId":"(UC[\w-]{20,24})"/) ||
    html.match(/<meta itemprop="(?:identifier|channelId)" content="(UC[\w-]{20,24})"/) ||
    html.match(/"channelId":"(UC[\w-]{20,24})"/);
  const channelId = channelIdMatch ? channelIdMatch[1] : undefined;

  /* Подписчики */
  let subscribers: number | undefined;
  const subRe =
    /"subscriberCountText":\s*\{\s*(?:"accessibility":[^}]+,\s*)?"simpleText":\s*"([^"]+)"/;
  const subM = html.match(subRe);
  if (subM) {
    const txt = subM[1].toLowerCase();
    const num = parseFloat(txt.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!Number.isNaN(num)) {
      if (txt.includes("m") || txt.includes("млн"))
        subscribers = Math.round(num * 1_000_000);
      else if (txt.includes("k") || txt.includes("тыс") || txt.includes("к"))
        subscribers = Math.round(num * 1000);
      else subscribers = Math.round(num);
    }
  }

  /* Шаг 2: RSS feed для видео. */
  if (!channelId) {
    return {
      title,
      subscribers,
      bio,
      posts: [],
      status: "empty",
      error: "Не удалось resolve channel_id из HTML",
    };
  }
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  let rssRes: Response;
  try {
    rssRes = await fetch(rssUrl, {
      headers: { "user-agent": "Mozilla/5.0 (content-studio competitors)" },
      redirect: "follow",
    });
  } catch (e) {
    return {
      title,
      subscribers,
      bio,
      posts: [],
      status: "fetch_error",
      error: e instanceof Error ? e.message.slice(0, 200) : String(e),
    };
  }
  if (!rssRes.ok) {
    return {
      title,
      subscribers,
      bio,
      posts: [],
      status: "http_error",
      error: `RSS HTTP ${rssRes.status}`,
    };
  }
  const xml = await rssRes.text();

  /* Парсим entry-блоки. */
  const posts: SamplePost[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let em: RegExpExecArray | null;
  while ((em = entryRe.exec(xml)) !== null && posts.length < 12) {
    const entry = em[1];
    const t = entry.match(/<title>([\s\S]*?)<\/title>/);
    const link = entry.match(/<link[^/]*href="([^"]+)"/);
    const published = entry.match(/<published>([\s\S]*?)<\/published>/);
    const desc = entry.match(
      /<media:description>([\s\S]*?)<\/media:description>/,
    );
    if (!t) continue;
    const titleText = t[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
      .slice(0, 200);
    const descText = desc
      ? desc[1]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .trim()
          .slice(0, 600)
      : "";
    posts.push({
      text: descText ? `${titleText}\n\n${descText}` : titleText,
      url: link ? link[1] : undefined,
      publishedAt: published ? published[1] : undefined,
    });
  }

  return {
    title,
    subscribers,
    bio,
    posts,
    status: posts.length > 0 ? "ok" : "empty",
  };
}

async function syncChannel(
  platform: "tg" | "yt",
  handle: string,
): Promise<SyncResult> {
  return platform === "tg" ? syncTelegram(handle) : syncYouTube(handle);
}

/* ------- AI-анализ канала. ------- */
type AnalysisReport = {
  niche_summary: string;
  what_works: string[];
  content_formats: string[];
  hook_patterns: string[];
  /* Поле всё ещё называется _for_serbolin для обратной совместимости с
     уже сохранёнными в БД отчётами competitor_channels.analysis_json
     (миграция переименования — отдельная задача). По смыслу теперь
     это «рекомендации текущему юзеру». */
  recommendations_for_serbolin: string[];
};

async function analyzeChannel(
  user: AuthUser,
  platform: "tg" | "yt",
  handle: string,
  title: string | undefined,
  posts: SamplePost[],
  subscribers: number | undefined,
  avgViews: number | undefined,
): Promise<AnalysisReport> {
  const sample = posts.slice(0, 12);
  const items = sample
    .map((p, i) => {
      const vk = p.views ? ` · ${p.views} ${platform === "yt" ? "views" : "просмотров"}` : "";
      return `[${i + 1}${vk}]\n${p.text.slice(0, 400)}`;
    })
    .join("\n---\n");

  const system = `${FITNESS_BASE_SYSTEM}

Текущая задача: проанализировать конкурента в фитнес-нише и выдать
структурированный отчёт, который автор сможет использовать в своей
контент-стратегии. Будь конкретным, без воды.`;

  const userMsg = `КОНКУРЕНТ: ${platform === "tg" ? "Telegram-канал" : "YouTube-канал"} @${handle}${
    title ? ` ("${title}")` : ""
  }${subscribers ? `, ${subscribers.toLocaleString("ru-RU")} подписчиков` : ""}${
    avgViews
      ? `, средние ${platform === "yt" ? "просмотры" : "просмотры поста"} ${avgViews.toLocaleString("ru-RU")}`
      : ""
  }.

ВЫБОРКА ${platform === "yt" ? "ВИДЕО" : "ПОСТОВ"}:
${items}

Верни строго JSON без markdown:
{
  "niche_summary": "1-2 предложения — кто этот автор и о чём (его ниша, фокус)",
  "what_works": ["3-5 пунктов: какой контент собирает больше всего вовлечения, почему"],
  "content_formats": ["2-4 формата которые автор активно использует (Reels/посты/лайвы/long-form)"],
  "hook_patterns": ["2-4 паттерна хуков которые автор использует (примеры из выборки)"],
  "recommendations_for_serbolin": ["2-4 конкретных способа применить найденное в собственном контенте — без копирования, через адаптацию под свой голос"]
}`;

  const r = await invokeRawForUser(user, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
  });
  const raw = r.choices[0]?.message.content;
  if (typeof raw !== "string") throw new Error("LLM пустой ответ");
  const cleaned = raw.replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as AnalysisReport;
  } catch {
    throw new Error(
      `LLM не вернул валидный JSON. Сырой ответ: ${cleaned.slice(0, 240)}`,
    );
  }
}

/* ------- D1 helpers. ------- */
async function seedIfEmpty(): Promise<void> {
  const existing = await d1Query<{ id: string }>(
    "SELECT id FROM competitor_channels LIMIT 1",
    [],
  );
  if (existing.length > 0) return;
  const now = Date.now();
  await d1Batch(
    DEFAULT_COMPETITORS.map((c) => ({
      sql: "INSERT OR IGNORE INTO competitor_channels (id, platform, handle, status, added_at) VALUES (?, ?, ?, 'unknown', ?)",
      params: [crypto.randomUUID(), c.platform, c.handle, now],
    })),
  );
}

type CompetitorRow = {
  id: string;
  platform: string;
  handle: string;
  title: string | null;
  subscribers: number | null;
  avg_views: number | null;
  bio: string | null;
  sample_posts_json: string | null;
  analysis_json: string | null;
  status: string;
  last_synced_at: number | null;
  last_analyzed_at: number | null;
  last_error: string | null;
};

const handleSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_.-]+$/, "Латиница/цифры/_/-/. без @");

export const competitorsRouter = router({
  list: protectedProcedure.query(async () => {
    if (!isD1Configured()) return [];
    await seedIfEmpty();
    const rows = await d1Query<CompetitorRow>(
      "SELECT id, platform, handle, title, subscribers, avg_views, bio, sample_posts_json, analysis_json, status, last_synced_at, last_analyzed_at, last_error FROM competitor_channels ORDER BY (status = 'ok') DESC, COALESCE(subscribers, 0) DESC, handle ASC",
      [],
    );
    return rows.map((r) => ({
      id: r.id,
      platform: r.platform as "tg" | "yt",
      handle: r.handle,
      title: r.title,
      subscribers: r.subscribers,
      avgViews: r.avg_views,
      bio: r.bio,
      samplePosts: r.sample_posts_json
        ? (JSON.parse(r.sample_posts_json) as SamplePost[])
        : [],
      analysis: r.analysis_json
        ? (JSON.parse(r.analysis_json) as AnalysisReport)
        : null,
      status: r.status,
      lastSyncedAt: r.last_synced_at,
      lastAnalyzedAt: r.last_analyzed_at,
      lastError: r.last_error,
    }));
  }),

  add: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["tg", "yt"]),
        handle: handleSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const cleaned = input.handle.replace(/^@/, "");
      const id = crypto.randomUUID();
      const now = Date.now();
      await d1Execute(
        "INSERT OR IGNORE INTO competitor_channels (id, platform, handle, status, added_at) VALUES (?, ?, ?, 'unknown', ?)",
        [id, input.platform, cleaned, now],
      );
      /* Сразу пробуем синкнуть, чтобы юзер увидел статус. */
      const r = await syncChannel(input.platform, cleaned);
      await d1Execute(
        "UPDATE competitor_channels SET title = ?, subscribers = ?, avg_views = ?, bio = ?, sample_posts_json = ?, status = ?, last_synced_at = ?, last_error = ? WHERE platform = ? AND handle = ?",
        [
          r.title ?? null,
          r.subscribers ?? null,
          r.avgViews ?? null,
          r.bio ?? null,
          JSON.stringify(r.posts),
          r.status,
          now,
          r.error ?? null,
          input.platform,
          cleaned,
        ],
      );
      return { ok: true, status: r.status, postCount: r.posts.length };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await d1Execute("DELETE FROM competitor_channels WHERE id = ?", [input.id]);
      return { ok: true };
    }),

  /* Парсит все каналы (по приоритету stale-first) — расход subrequests
     контролируем PARSE_LIMIT'ом, как в trends. */
  refresh: protectedProcedure
    .input(z.object({}).optional())
    .mutation(async () => {
      if (!isD1Configured()) throw new Error("D1 не настроен");
      await seedIfEmpty();
      const PARSE_LIMIT = 25; // меньше чем в trends, потому что параллельно с возможным анализом
      const rows = await d1Query<{
        id: string;
        platform: string;
        handle: string;
      }>(
        "SELECT id, platform, handle FROM competitor_channels ORDER BY COALESCE(last_synced_at, 0) ASC LIMIT ?",
        [PARSE_LIMIT],
      );
      const now = Date.now();
      const updates: { sql: string; params: (string | number | null)[] }[] = [];
      let okCount = 0;
      for (const row of rows) {
        const r = await syncChannel(row.platform as "tg" | "yt", row.handle);
        if (r.status === "ok") okCount++;
        updates.push({
          sql: "UPDATE competitor_channels SET title = ?, subscribers = ?, avg_views = ?, bio = ?, sample_posts_json = ?, status = ?, last_synced_at = ?, last_error = ? WHERE id = ?",
          params: [
            r.title ?? null,
            r.subscribers ?? null,
            r.avgViews ?? null,
            r.bio ?? null,
            JSON.stringify(r.posts),
            r.status,
            now,
            r.error ?? null,
            row.id,
          ],
        });
      }
      await d1Batch(updates);
      return { ok: true, total: rows.length, okCount };
    }),

  analyze: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const rows = await d1Query<CompetitorRow>(
        "SELECT id, platform, handle, title, subscribers, avg_views, bio, sample_posts_json, analysis_json, status, last_synced_at, last_analyzed_at, last_error FROM competitor_channels WHERE id = ? LIMIT 1",
        [input.id],
      );
      const row = rows[0];
      if (!row) throw new Error("Канал не найден");
      const posts = row.sample_posts_json
        ? (JSON.parse(row.sample_posts_json) as SamplePost[])
        : [];
      if (posts.length < 3) {
        throw new Error(
          "Мало данных для анализа — сначала засинхронь канал (нужно ≥3 поста)",
        );
      }
      const report = await analyzeChannel(
        ctx.user,
        row.platform as "tg" | "yt",
        row.handle,
        row.title ?? undefined,
        posts,
        row.subscribers ?? undefined,
        row.avg_views ?? undefined,
      );
      await d1Execute(
        "UPDATE competitor_channels SET analysis_json = ?, last_analyzed_at = ? WHERE id = ?",
        [JSON.stringify(report), Date.now(), input.id],
      );
      return report;
    }),
});
