import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { d1Execute, d1Query, isD1Configured } from "../_core/d1";
import { invokeRawForUser } from "../_core/llm-guard";
import type { IntegrationsData, VoiceProfile } from "../_core/voice";

/* ============================================================
   Integrations router — синк публичных каналов и голосовой профиль.

   Stack: t.me/s/<channel> = публичный preview без API. Скачиваем
   HTML на стороне Worker'a, режем регулярками (LLM-парсинг был бы
   медленнее и дороже), отдаём JSON. Затем — отдельный LLM-вызов
   на анализ голоса по реальным постам. Результат хранится одной
   JSON-строкой в таблице integrations.
   ============================================================ */

const wsKey = z.string().min(8).max(64);

async function readIntegrations(workspaceKey: string): Promise<IntegrationsData> {
  if (!isD1Configured()) return {};
  const rows = await d1Query<{ data_json: string }>(
    "SELECT data_json FROM integrations WHERE workspace_key = ? LIMIT 1",
    [workspaceKey],
  );
  if (!rows[0]) return {};
  try {
    return JSON.parse(rows[0].data_json) as IntegrationsData;
  } catch {
    return {};
  }
}

async function writeIntegrations(
  workspaceKey: string,
  data: IntegrationsData,
): Promise<void> {
  await d1Execute(
    `INSERT INTO integrations (workspace_key, data_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(workspace_key) DO UPDATE SET
       data_json = excluded.data_json,
       updated_at = excluded.updated_at`,
    [workspaceKey, JSON.stringify(data), Date.now()],
  );
}

/* HTML-парсер для t.me/s/<channel>. Telegram отдаёт server-side
   рендер preview-страницы — структура стабильна, регулярки надёжнее
   и быстрее, чем LLM. */
function parseTelegramPreview(html: string): {
  subscribers: number | null;
  bio: string | null;
  posts: Array<{ text: string; views: number | null }>;
  channel: string | null;
} {
  /* Подписчики: "326 subscribers" / "326 подписчиков" */
  const subMatch = html.match(
    /([\d\s]+)\s*(subscribers|members|подписчик|подписчиков|подписчика)/i,
  );
  const subscribers = subMatch
    ? Number(subMatch[1].replace(/\s+/g, "")) || null
    : null;

  /* Bio — внутри <div class="tgme_channel_info_description">…</div>. */
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
        .slice(0, 600) || null
    : null;

  /* Заголовок канала. */
  const titleMatch = html.match(
    /tgme_channel_info_header_title[^>]*>([\s\S]*?)<\/div>/i,
  );
  const channel = titleMatch
    ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
    : null;

  /* Посты: блоки tgme_widget_message_text + tgme_widget_message_views. */
  const posts: Array<{ text: string; views: number | null }> = [];
  const postRegex =
    /tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>[\s\S]*?(?:tgme_widget_message_views[^>]*>([^<]+)<)?/gi;
  let m: RegExpExecArray | null;
  while ((m = postRegex.exec(html)) !== null) {
    const text = m[1]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .trim();
    if (text.length < 10) continue;
    /* "319" / "1.2K" / "23.4K" */
    let views: number | null = null;
    if (m[2]) {
      const raw = m[2].trim();
      const num = parseFloat(raw.replace(/[, ]/g, ""));
      if (/k$/i.test(raw)) views = Math.round(num * 1000);
      else if (/m$/i.test(raw)) views = Math.round(num * 1_000_000);
      else views = Math.round(num) || null;
    }
    posts.push({ text: text.slice(0, 4000), views });
    if (posts.length >= 30) break;
  }
  return { subscribers, bio, posts, channel };
}

export const integrationsRouter = router({
  status: protectedProcedure.query(() => ({ enabled: isD1Configured() })),

  get: protectedProcedure
    .query(async ({ input, ctx }) => readIntegrations(ctx.user.id)),

  syncTelegram: protectedProcedure
    .input(
      z.object({
        /* Принимаем либо @username, либо t.me/<username>, либо чистое имя. */
        channel: z.string().min(2).max(64),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const cleaned = input.channel
        .trim()
        .replace(/^@/, "")
        .replace(/^https?:\/\/t\.me\/(s\/)?/, "")
        .replace(/\/.*$/, "");
      const url = `https://t.me/s/${cleaned}`;
      const res = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (content-studio sync)" },
      });
      if (!res.ok) {
        throw new Error(`Telegram preview ${res.status} для ${cleaned}`);
      }
      const html = await res.text();
      const parsed = parseTelegramPreview(html);
      if (parsed.posts.length === 0) {
        throw new Error(
          `Не нашёл ни одного поста на ${url}. Канал приватный или имя неверное?`,
        );
      }
      const avg =
        parsed.posts
          .map((p) => p.views ?? 0)
          .filter((v) => v > 0)
          .reduce((a, b) => a + b, 0) /
          Math.max(1, parsed.posts.filter((p) => p.views).length) || 0;

      const existing = await readIntegrations(ctx.user.id);
      const next: IntegrationsData = {
        ...existing,
        tg: {
          url: `https://t.me/${cleaned}`,
          channel: parsed.channel ? `@${cleaned}` : `@${cleaned}`,
          subscribers: parsed.subscribers ?? undefined,
          avg_views: Math.round(avg) || undefined,
          bio: parsed.bio ?? undefined,
          posts: parsed.posts.map((p) => ({
            text: p.text,
            views: p.views ?? undefined,
          })),
          synced_at: Date.now(),
        },
      };
      await writeIntegrations(ctx.user.id, next);
      return {
        subscribers: parsed.subscribers,
        avg_views: Math.round(avg),
        posts_count: parsed.posts.length,
        bio: parsed.bio,
      };
    }),

  analyzeVoice: protectedProcedure
    .mutation(async ({ input, ctx }) => {
      const data = await readIntegrations(ctx.user.id);
      const posts = data.tg?.posts ?? [];
      if (posts.length < 3) {
        throw new Error(
          "Нужно минимум 3 поста. Сначала засинхронь Telegram-канал.",
        );
      }
      const sample = posts.slice(0, 20);
      const block = sample
        .map(
          (p, i) =>
            `[Пост ${i + 1}${p.views ? ` · ${p.views} просмотров` : ""}]\n${p.text}`,
        )
        .join("\n---\n");

      const system =
        "Ты литературный редактор-аналитик. Твоя задача — извлечь устойчивые черты " +
        "авторского голоса из реальных постов канала и описать их в JSON. " +
        "Опирайся только на присланные тексты, не выдумывай.";
      const user = `Проанализируй реальные посты Telegram-канала.

ТЕКСТЫ:
${block}

Верни ТОЛЬКО JSON без markdown-обёртки:
{
  "summary": "суть голоса 2-3 предложения",
  "tone_tags": ["5-8 прилагательных"],
  "sentence_style": "короткие | длинные | смешанные",
  "hook_patterns": ["паттерн 1", "паттерн 2", "паттерн 3"],
  "topics_preferred": ["тема 1", "тема 2", "тема 3", "тема 4", "тема 5"],
  "avoid": ["чего нет в текстах автора"],
  "example_phrases": ["дословная фраза 1", "фраза 2", "фраза 3"],
  "audience_address": "ты | вы | ребята",
  "cta_style": "как заканчивает посты",
  "emoji_usage": "активно | умеренно | редко",
  "post_count_analyzed": ${sample.length}
}`;

      const r = await invokeRawForUser(ctx.user, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const raw = r.choices[0]?.message.content;
      if (typeof raw !== "string") throw new Error("LLM вернул пустой ответ");
      const cleaned = raw
        .replace(/^```(json)?/i, "")
        .replace(/```$/i, "")
        .trim();
      let profile: VoiceProfile & {
        analyzed_at?: number;
        post_count_analyzed?: number;
      };
      try {
        profile = JSON.parse(cleaned);
      } catch {
        throw new Error(
          `LLM не отдал валидный JSON. Сырой ответ: ${cleaned.slice(0, 240)}`,
        );
      }
      profile.analyzed_at = Date.now();
      profile.post_count_analyzed = sample.length;
      const next: IntegrationsData = { ...data, voiceProfile: profile };
      await writeIntegrations(ctx.user.id, next);
      return profile;
    }),

  clearVoice: protectedProcedure
    .mutation(async ({ input, ctx }) => {
      const data = await readIntegrations(ctx.user.id);
      delete data.voiceProfile;
      await writeIntegrations(ctx.user.id, data);
      return { ok: true };
    }),
});
