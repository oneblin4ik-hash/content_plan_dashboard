/**
 * Voice profile loader — подгружает per-workspace профиль голоса
 * из таблицы integrations и форматирует префикс для системного промпта.
 *
 * Идея #3-5 из спека: после синка t.me/s/<channel> и анализа постов
 * у каждого workspace появляется voiceProfile. Здесь — общий хелпер,
 * который вызывается из content.ts перед каждой генерацией.
 */
import { d1Query, isD1Configured } from "./d1";

export type VoiceProfile = {
  summary?: string;
  tone_tags?: string[];
  sentence_style?: string;
  hook_patterns?: string[];
  topics_preferred?: string[];
  avoid?: string[];
  example_phrases?: string[];
  audience_address?: string;
  cta_style?: string;
  emoji_usage?: string;
};

export type IntegrationsData = {
  tg?: {
    url?: string;
    channel?: string;
    subscribers?: number;
    avg_views?: number;
    bio?: string;
    posts?: Array<{ text: string; views?: number }>;
    synced_at?: number;
  };
  ig?: {
    username?: string;
    followers?: number | null;
    bio?: string | null;
    synced_at?: number;
  };
  voiceProfile?: VoiceProfile & { analyzed_at?: number; post_count_analyzed?: number };
};

export async function loadIntegrations(
  workspaceKey?: string | null,
): Promise<IntegrationsData | null> {
  if (!workspaceKey || !isD1Configured()) return null;
  const rows = await d1Query<{ data_json: string }>(
    "SELECT data_json FROM integrations WHERE workspace_key = ? LIMIT 1",
    [workspaceKey],
  );
  if (!rows[0]) return null;
  try {
    return JSON.parse(rows[0].data_json) as IntegrationsData;
  } catch {
    return null;
  }
}

export function formatVoiceContext(vp?: VoiceProfile | null): string {
  if (!vp?.summary) return "";
  const arr = (a?: string[]) => (a && a.length ? a.join(", ") : "");
  const slash = (a?: string[]) => (a && a.length ? a.join(" / ") : "");
  const lines = [
    "",
    "ПРОФИЛЬ ГОЛОСА АВТОРА (строго соблюдай, он важнее общих правил):",
    `Суть: ${vp.summary}`,
    vp.tone_tags?.length ? `Тональность: ${arr(vp.tone_tags)}` : "",
    vp.sentence_style ? `Стиль предложений: ${vp.sentence_style}` : "",
    vp.hook_patterns?.length ? `Любимые хуки: ${slash(vp.hook_patterns)}` : "",
    vp.topics_preferred?.length ? `Любимые темы: ${arr(vp.topics_preferred)}` : "",
    vp.example_phrases?.length ? `Образцы фраз: ${slash(vp.example_phrases)}` : "",
    vp.audience_address ? `Обращение к ЦА: ${vp.audience_address}` : "",
    vp.cta_style ? `Стиль CTA: ${vp.cta_style}` : "",
    vp.emoji_usage ? `Эмодзи: ${vp.emoji_usage}` : "",
    vp.avoid?.length ? `Избегать (нет в реальных постах): ${arr(vp.avoid)}` : "",
  ].filter(Boolean);
  return "\n" + lines.join("\n");
}

export async function loadVoiceCtx(workspaceKey?: string | null): Promise<string> {
  try {
    const intg = await loadIntegrations(workspaceKey);
    return formatVoiceContext(intg?.voiceProfile);
  } catch {
    return "";
  }
}
