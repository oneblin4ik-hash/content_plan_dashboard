/**
 * Guarded LLM-вызов с учётом триала и бюджета токенов.
 *
 * Логика:
 *   1. Проверяем триал и баланс токенов юзера (throw если кончилось).
 *   2. Грузим voice пользователя → собираем системный промпт из
 *      FITNESS_BASE_SYSTEM + персональный блок + petля результата
 *      (performance context).
 *   3. Вызываем invokeLLM.
 *   4. Списываем usage.total_tokens из users.tokens_remaining.
 *
 * Используется во всех процедурах content.ts. Остальные LLM-роутеры
 * (topics, competitors, integrations.analyzeVoice, metrics.insights)
 * пока вызывают invokeLLM напрямую без guard — будут переведены
 * следующей итерацией; ничего не ломают, но и триал на них не
 * распространяется.
 */
import { TRPCError } from "@trpc/server";
import { invokeLLM, type InvokeParams, type InvokeResult } from "./llm";
import { d1Execute, d1Query } from "./d1";
import { buildSystemPrompt, type VoiceConfig } from "./voice-config";
import { loadPerformanceContext } from "./performance";
import type { AuthUser } from "./context";

export type GuardedResult = { text: string; model: string };

async function loadUserVoice(userId: string): Promise<VoiceConfig | null> {
  try {
    const rows = await d1Query<{ voice_json: string | null }>(
      "SELECT voice_json FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    const raw = rows[0]?.voice_json;
    if (!raw) return null;
    return JSON.parse(raw) as VoiceConfig;
  } catch {
    return null;
  }
}

export function assertCanGenerate(user: AuthUser) {
  /* Админу — безлимит: не проверяем триал и баланс, не списываем
     токены. Чтобы я мог пользоваться сервисом, не тратя пробный
     бюджет, и тестировать долгие LLM-сессии без оглядки на лимит. */
  if (user.role === "admin") return;
  const now = Date.now();
  if (user.plan === "trial" && user.trialEndsAt < now) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Пробный период закончился. Оформи подписку, чтобы продолжить генерацию.",
    });
  }
  if (user.tokensRemaining <= 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Лимит токенов исчерпан. Оформи подписку, чтобы пополнить баланс.",
    });
  }
}

/**
 * task — постановочная часть промпта (что нужно сгенерировать).
 * Базовый системный блок (правила ремесла) и персональный голос
 * добавляются автоматически.
 */
export async function invokeForUser(
  user: AuthUser,
  task: string,
  userPrompt: string,
): Promise<GuardedResult> {
  assertCanGenerate(user);

  const [voice, perfCtx] = await Promise.all([
    loadUserVoice(user.id),
    loadPerformanceContext(user.id),
  ]);
  const baseSystem = buildSystemPrompt(voice);
  const fullSystem = `${baseSystem}${perfCtx}\n\n${task}`;

  const r = await invokeLLM({
    messages: [
      { role: "system", content: fullSystem },
      { role: "user", content: userPrompt },
    ],
  });

  const out = r.choices[0]?.message.content;
  if (!out || typeof out !== "string") {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "LLM вернул пустой ответ",
    });
  }
  const model = (r.model ?? "").replace(/^models\//, "");

  /* Списание токенов. usage может быть undefined у некоторых
     fallback-ответов — тогда списываем «по факту» приблизительно
     (длина в word ≈ tokens / 1.3). Это конкретно для случая, когда
     usage отсутствует — лучше слегка штрафовать, чем пускать
     бесконечно. */
  const used =
    r.usage?.total_tokens ??
    Math.max(200, Math.ceil(fullSystem.length / 3 + out.length / 3));
  /* Админу токены не списываем — у него безлимит. tokens_used_total
     обычным юзерам нужен для будущей аналитики/биллинга, админу
     бессмысленно (его генерации не считаются «продуктом»). */
  if (user.role === "admin") return { text: out, model };
  try {
    await d1Execute(
      "UPDATE users SET tokens_remaining = MAX(0, tokens_remaining - ?), tokens_used_total = tokens_used_total + ? WHERE id = ?",
      [used, used, user.id],
    );
  } catch {
    /* Если списание не удалось — пускаем результат всё равно;
       юзер не должен страдать от наших инфраструктурных проблем. */
  }

  return { text: out, model };
}

/**
 * Облегчённая обёртка для роутеров, которые сами строят свой
 * системный промпт (topics.generate, competitors.analyze, integrations.
 * analyzeVoice, metrics.insights). Делает то же самое, что
 * invokeForUser, но без подмешивания voice/performance — потому что
 * там специализированные задачи (структурированный JSON, анализ
 * корпуса постов), где зашитый «голос автора» только мешал бы.
 *
 * Контракт: trial/tokens guard срабатывает, токены списываются по
 * usage.total_tokens — иначе любой бесплатный юзер сможет жечь
 * безлимит через прокладку этих роутеров.
 */
export async function invokeRawForUser(
  user: AuthUser,
  params: InvokeParams,
): Promise<InvokeResult> {
  assertCanGenerate(user);
  const r = await invokeLLM(params);
  if (user.role === "admin") return r;
  const used = r.usage?.total_tokens;
  if (typeof used === "number" && used > 0) {
    try {
      await d1Execute(
        "UPDATE users SET tokens_remaining = MAX(0, tokens_remaining - ?), tokens_used_total = tokens_used_total + ? WHERE id = ?",
        [used, used, user.id],
      );
    } catch {
      /* не блокируем результат при инфраструктурной проблеме */
    }
  }
  return r;
}
