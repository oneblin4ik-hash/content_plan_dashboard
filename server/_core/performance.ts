/**
 * Performance context loader — собирает «петлю результата»: подмешивает
 * в системный промпт генерации данные о том, что у этого пользователя
 * реально зашло (топ постов по engagement), что не сработало (худшие),
 * и какие приёмы конкурентов AI порекомендовал применить.
 *
 * Это превращает студию из «генератора красивого текста» в «генератор
 * того, что работает именно у тебя». Все запросы — read-only к D1.
 *
 * Используется из server/routers/content.ts → callLLM.
 */
import { d1Query, isD1Configured } from "./d1";

type MetricRow = {
  post_title: string;
  post_type: string;
  topic: string | null;
  views: number;
  reactions: number;
  comments: number;
  saves: number;
  shares: number;
};

type CompetitorRow = {
  handle: string;
  platform: string;
  analysis_json: string | null;
};

type CompetitorAnalysis = {
  recommendations_for_serbolin?: string[];
  what_works?: string[];
  hook_patterns?: string[];
};

/* Engagement rate в той же формуле, что использует UI Аналитики:
   (reactions + comments + saves + shares) / views * 100. */
function engagementRate(m: MetricRow): number {
  if (!m.views || m.views === 0) return 0;
  return ((m.reactions + m.comments + m.saves + m.shares) / m.views) * 100;
}

/* Сколько постов считать «достаточной выборкой» для контекста. Меньше
   3 — статистики нет, не показываем (один-два случайных поста только
   засорят промпт). */
const MIN_POSTS_FOR_CONTEXT = 3;
const TOP_N = 5;
const WORST_N = 3;
const MAX_TITLE_LEN = 90;

export async function loadPerformanceContext(
  workspaceKey?: string | null,
): Promise<string> {
  if (!workspaceKey || !isD1Configured()) return "";

  try {
    const [metrics, competitors] = await Promise.all([
      d1Query<MetricRow>(
        `SELECT post_title, post_type, topic, views, reactions, comments, saves, shares
         FROM post_metrics
         WHERE workspace_key = ? AND views > 0
         ORDER BY published_at DESC LIMIT 50`,
        [workspaceKey],
      ),
      d1Query<CompetitorRow>(
        `SELECT handle, platform, analysis_json
         FROM competitor_channels
         WHERE analysis_json IS NOT NULL
         ORDER BY COALESCE(last_analyzed_at, 0) DESC LIMIT 5`,
        [],
      ),
    ]);

    const parts: string[] = [];

    /* ─── Что зашло / не зашло у пользователя ─── */
    if (metrics.length >= MIN_POSTS_FOR_CONTEXT) {
      const withER = metrics.map((m) => ({ ...m, er: engagementRate(m) }));
      const top = [...withER].sort((a, b) => b.er - a.er).slice(0, TOP_N);
      const worst = [...withER].sort((a, b) => a.er - b.er).slice(0, WORST_N);

      const fmt = (m: typeof top[number]) => {
        const t = m.post_title.slice(0, MAX_TITLE_LEN);
        const topic = m.topic ? ` (${m.topic})` : "";
        return `• "${t}"${topic} — ER ${m.er.toFixed(1)}% · ${m.views.toLocaleString("ru-RU")} просм.`;
      };

      parts.push(
        [
          "",
          "ПЕТЛЯ РЕЗУЛЬТАТА — ЧТО РЕАЛЬНО РАБОТАЕТ У ТЕБЯ:",
          `Топ-${top.length} постов по engagement (опирайся на эти темы/форматы/хуки):`,
          ...top.map(fmt),
          "",
          `Худшие ${worst.length} (избегай похожих заходов и тем):`,
          ...worst.map(fmt),
        ].join("\n"),
      );
    }

    /* ─── Что подсмотреть у конкурентов (только recommendations) ─── */
    const competitorRecs: string[] = [];
    for (const c of competitors) {
      if (!c.analysis_json) continue;
      try {
        const a = JSON.parse(c.analysis_json) as CompetitorAnalysis;
        const recs = a.recommendations_for_serbolin ?? [];
        for (const r of recs.slice(0, 2)) {
          competitorRecs.push(`• [@${c.handle}] ${r}`);
        }
      } catch {
        /* битый JSON в analysis_json — игнорируем */
      }
      if (competitorRecs.length >= 8) break;
    }
    if (competitorRecs.length > 0) {
      parts.push(
        [
          "",
          "ПРИЁМЫ КОНКУРЕНТОВ (адаптируй под голос Эдуарда, не копируй дословно):",
          ...competitorRecs.slice(0, 8),
        ].join("\n"),
      );
    }

    return parts.length > 0 ? "\n" + parts.join("\n") : "";
  } catch {
    /* Петля — bonus, а не блокер. Если D1 чихнул — генерация всё равно
       идёт, просто без подмешивания. */
    return "";
  }
}

/* Быстрая статистика для UI badge'а в Студии: «учитывает X постов и
   Y конкурентов». Отдельный лёгкий запрос, чтобы не таскать всю
   выборку. */
export async function getPerformanceContextStats(
  workspaceKey?: string | null,
): Promise<{ metrics: number; competitors: number; enabled: boolean }> {
  if (!workspaceKey || !isD1Configured()) {
    return { metrics: 0, competitors: 0, enabled: false };
  }
  try {
    const [mc, cc] = await Promise.all([
      d1Query<{ n: number }>(
        "SELECT COUNT(*) AS n FROM post_metrics WHERE workspace_key = ? AND views > 0",
        [workspaceKey],
      ),
      d1Query<{ n: number }>(
        "SELECT COUNT(*) AS n FROM competitor_channels WHERE analysis_json IS NOT NULL",
        [],
      ),
    ]);
    const metrics = mc[0]?.n ?? 0;
    const competitors = cc[0]?.n ?? 0;
    return {
      metrics,
      competitors,
      enabled: metrics >= MIN_POSTS_FOR_CONTEXT || competitors > 0,
    };
  } catch {
    return { metrics: 0, competitors: 0, enabled: false };
  }
}
