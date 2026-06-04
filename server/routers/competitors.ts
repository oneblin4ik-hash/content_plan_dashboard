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
const DEFAULT_COMPETITORS: Array<{ platform: Platform; handle: string }> = [
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

type Platform = "tg" | "yt" | "ig";

type SyncResult = {
  title?: string;
  subscribers?: number;
  avgViews?: number;
  bio?: string;
  posts: SamplePost[];
  status: "ok" | "empty" | "http_error" | "fetch_error";
  error?: string;
};

/* Нормализация ввода: юзер может вставить @handle, голый handle, полную
   ссылку или (для YT) channel_id UC… Приводим к «чистому» идентификатору
   под каждую платформу. Возвращаем то, что дальше передаём в парсер. */
export function normalizeHandle(platform: Platform, raw: string): string {
  let s = raw.trim();
  /* Вырезаем протокол и хост, оставляя путь — чтобы из
     https://t.me/durov и https://youtube.com/@mkbhd достать хвост. */
  const urlMatch = s.match(/^https?:\/\/([^/]+)\/(.+)$/i);
  if (urlMatch) {
    const host = urlMatch[1].toLowerCase();
    let path = urlMatch[2];
    if (platform === "tg") {
      // t.me/s/<channel> или t.me/<channel>
      path = path.replace(/^s\//, "");
      s = path.split(/[/?#]/)[0];
    } else if (platform === "yt") {
      // youtube.com/@handle, /channel/UC..., /c/Name, /user/Name
      if (/^channel\/UC/i.test(path)) {
        s = path.split("/")[1].split(/[?#]/)[0]; // UC...
      } else {
        s = path
          .replace(/^@/, "")
          .replace(/^(c|user)\//, "")
          .split(/[/?#]/)[0];
      }
    } else {
      // instagram.com/<user>/...
      void host;
      s = path.split(/[/?#]/)[0];
    }
  }
  return s.replace(/^@/, "").trim();
}

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
   Главная идея: RSS-фид /feeds/videos.xml?channel_id=UC… стабилен и
   почти не блокируется, а HTML-страница канала из дата-центра часто
   ловит 429 / consent-wall. Поэтому:

   1) Если на входе уже channel_id (UC…) — идём сразу в RSS, без HTML.
   2) Если @handle — резолвим channel_id из HTML (с consent-cookie,
      чтобы обойти EU-интерстишл), затем RSS.
   3) Подписчики берём из HTML (если он открылся), просмотры по каждому
      видео — из RSS (<media:statistics views=…>), поэтому avgViews
      теперь работает без отдельных запросов на каждое видео.

   Если HTML заблокирован, но это @handle — отдаём понятную ошибку с
   подсказкой вставить channel_id или ссылку /channel/UC…. */

const YT_BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  /* CONSENT/SOCS cookie снимают EU consent-редирект, из-за которого
     прилетал 429/302 на пустую страницу. */
  cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+000; SOCS=CAISEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg",
};

async function ytResolveChannelId(
  handle: string,
): Promise<{ channelId?: string; title?: string; bio?: string; subscribers?: number; httpStatus?: number; error?: string }> {
  const channelUrl = `https://www.youtube.com/@${encodeURIComponent(handle)}`;
  let htmlRes: Response;
  try {
    htmlRes = await fetch(channelUrl, {
      headers: YT_BROWSER_HEADERS,
      redirect: "follow",
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message.slice(0, 200) : String(e) };
  }
  if (!htmlRes.ok) {
    return { httpStatus: htmlRes.status, error: `HTTP ${htmlRes.status}` };
  }
  const html = await htmlRes.text();

  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
  const title = titleMatch ? titleMatch[1].slice(0, 120) : undefined;
  const descMatch = html.match(
    /<meta property="og:description" content="([^"]+)"/,
  );
  const bio = descMatch ? descMatch[1].slice(0, 500) : undefined;

  const channelIdMatch =
    html.match(/"externalId":"(UC[\w-]{20,24})"/) ||
    html.match(/<meta itemprop="(?:identifier|channelId)" content="(UC[\w-]{20,24})"/) ||
    html.match(/"channelId":"(UC[\w-]{20,24})"/) ||
    html.match(/\/channel\/(UC[\w-]{20,24})/);
  const channelId = channelIdMatch ? channelIdMatch[1] : undefined;

  let subscribers: number | undefined;
  const subM = html.match(
    /"subscriberCountText":\s*\{\s*(?:"accessibility":[^}]+,\s*)?"simpleText":\s*"([^"]+)"/,
  );
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
  return { channelId, title, bio, subscribers };
}

async function syncYouTube(input: string): Promise<SyncResult> {
  /* Прямой channel_id — самый надёжный путь, минуем HTML. */
  const isChannelId = /^UC[\w-]{20,24}$/.test(input);
  let channelId: string | undefined = isChannelId ? input : undefined;
  let title: string | undefined;
  let bio: string | undefined;
  let subscribers: number | undefined;

  if (!channelId) {
    const r = await ytResolveChannelId(input);
    channelId = r.channelId;
    title = r.title;
    bio = r.bio;
    subscribers = r.subscribers;
    if (!channelId) {
      /* HTML заблокирован или не отдал id — честная подсказка. */
      const hint =
        r.httpStatus === 429
          ? "YouTube временно блокирует автозапрос с сервера. Вставь ссылку вида youtube.com/channel/UC… или сам channel_id (UC…)."
          : "Не удалось определить channel_id. Вставь ссылку youtube.com/channel/UC… или channel_id (UC…).";
      return {
        title,
        subscribers,
        bio,
        posts: [],
        status: "http_error",
        error: hint,
      };
    }
  }

  /* RSS-фид — основной источник постов и просмотров. */
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  let rssRes: Response;
  try {
    rssRes = await fetch(rssUrl, {
      headers: { "user-agent": YT_BROWSER_HEADERS["user-agent"] },
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
      error: `RSS HTTP ${rssRes.status} (проверь, что channel_id верный)`,
    };
  }
  const xml = await rssRes.text();

  /* Title канала из RSS, если не достали из HTML. */
  if (!title) {
    const feedTitle = xml.match(/<title>([\s\S]*?)<\/title>/);
    if (feedTitle) title = decodeXml(feedTitle[1]).slice(0, 120);
  }

  const posts: SamplePost[] = [];
  const views: number[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let em: RegExpExecArray | null;
  while ((em = entryRe.exec(xml)) !== null && posts.length < 12) {
    const entry = em[1];
    const t = entry.match(/<media:title>([\s\S]*?)<\/media:title>/) ||
      entry.match(/<title>([\s\S]*?)<\/title>/);
    const link = entry.match(/<link[^/]*href="([^"]+)"/);
    const published = entry.match(/<published>([\s\S]*?)<\/published>/);
    const desc = entry.match(
      /<media:description>([\s\S]*?)<\/media:description>/,
    );
    const viewsM = entry.match(/<media:statistics\s+views="(\d+)"/);
    if (!t) continue;
    const titleText = decodeXml(t[1]).trim().slice(0, 200);
    const descText = desc ? decodeXml(desc[1]).trim().slice(0, 600) : "";
    const v = viewsM ? parseInt(viewsM[1], 10) : undefined;
    if (typeof v === "number" && !Number.isNaN(v)) views.push(v);
    posts.push({
      text: descText ? `${titleText}\n\n${descText}` : titleText,
      url: link ? link[1] : undefined,
      publishedAt: published ? published[1] : undefined,
      views: v,
    });
  }

  const avgViews =
    views.length > 0
      ? Math.round(views.reduce((a, b) => a + b, 0) / views.length)
      : undefined;

  return {
    title,
    subscribers,
    avgViews,
    bio,
    posts,
    status: posts.length > 0 ? "ok" : "empty",
    error: posts.length === 0 ? "RSS не вернул видео (канал пустой или приватный)" : undefined,
  };
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

/* ------- Instagram парсер (web_profile_info, без официального API). -------
   Instagram отдаёт публичный JSON по эндпоинту web_profile_info, если
   передать заголовок x-ig-app-id (публичный id веб-клиента). С дата-
   центровых IP IG агрессивно банит — поэтому путь «best effort»:
   получилось — парсим подписи последних постов + лайки/комменты; нет —
   честный http_error с подсказкой. Подписи постов — это главное, что
   нужно AI-анализу. */
const IG_APP_ID = "936619743392459";

async function syncInstagram(handle: string): Promise<SyncResult> {
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "x-ig-app-id": IG_APP_ID,
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "x-requested-with": "XMLHttpRequest",
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
  if (!res.ok) {
    return {
      posts: [],
      status: "http_error",
      error:
        res.status === 401 || res.status === 403 || res.status === 429
          ? "Instagram заблокировал автозапрос с сервера (частая ситуация). Попробуй позже или добавь TG/YouTube."
          : `HTTP ${res.status}`,
    };
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    return { posts: [], status: "http_error", error: "IG вернул не-JSON (вероятно, login-wall)" };
  }
  const u = data?.data?.user;
  if (!u) {
    return { posts: [], status: "http_error", error: "Профиль не найден или приватный" };
  }
  const title: string | undefined = u.full_name || undefined;
  const bio: string | undefined = u.biography
    ? String(u.biography).slice(0, 500)
    : undefined;
  const subscribers: number | undefined =
    typeof u.edge_followed_by?.count === "number"
      ? u.edge_followed_by.count
      : undefined;

  const edges: any[] =
    u.edge_owner_to_timeline_media?.edges ?? [];
  const posts: SamplePost[] = [];
  const likeCounts: number[] = [];
  for (const e of edges.slice(0, 12)) {
    const node = e?.node;
    if (!node) continue;
    const caption: string =
      node.edge_media_to_caption?.edges?.[0]?.node?.text ?? "";
    const likes: number | undefined =
      typeof node.edge_liked_by?.count === "number"
        ? node.edge_liked_by.count
        : typeof node.edge_media_preview_like?.count === "number"
          ? node.edge_media_preview_like.count
          : undefined;
    if (typeof likes === "number") likeCounts.push(likes);
    const shortcode = node.shortcode;
    if (!caption && !shortcode) continue;
    posts.push({
      text: caption.slice(0, 600) || "(пост без подписи)",
      url: shortcode ? `https://www.instagram.com/p/${shortcode}/` : undefined,
      views: typeof node.video_view_count === "number" ? node.video_view_count : likes,
      publishedAt: node.taken_at_timestamp
        ? new Date(node.taken_at_timestamp * 1000).toISOString()
        : undefined,
    });
  }
  const avgViews =
    likeCounts.length > 0
      ? Math.round(likeCounts.reduce((a, b) => a + b, 0) / likeCounts.length)
      : undefined;

  return {
    title,
    subscribers,
    avgViews,
    bio,
    posts,
    status: posts.length > 0 ? "ok" : "empty",
    error: posts.length === 0 ? "Нет публичных постов" : undefined,
  };
}

async function syncChannel(
  platform: Platform,
  handle: string,
): Promise<SyncResult> {
  /* handle уже нормализован на входе add/refresh, но на всякий случай
     прогоняем ещё раз — дешёво и страхует от старых записей в БД. */
  const h = normalizeHandle(platform, handle);
  if (platform === "tg") return syncTelegram(h);
  if (platform === "yt") return syncYouTube(h);
  return syncInstagram(h);
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
  platform: Platform,
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
      platform: r.platform as Platform,
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
        platform: z.enum(["tg", "yt", "ig"]),
        /* Принимаем сырой ввод (@handle, ссылка, UC-id) — нормализуем
           и валидируем уже после. Поэтому схема тут мягкая. */
        handle: z.string().min(2).max(200),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const cleaned = normalizeHandle(input.platform, input.handle);
      if (!/^[A-Za-z0-9_.-]+$/.test(cleaned)) {
        throw new Error(
          "Не разобрал имя канала. Вставь @handle, ссылку или (для YouTube) channel_id (UC…).",
        );
      }
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
        const r = await syncChannel(row.platform as Platform, row.handle);
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
        row.platform as Platform,
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
