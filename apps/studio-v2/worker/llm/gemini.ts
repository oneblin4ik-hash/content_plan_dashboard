import type { Env } from "../env";
import { LlmError } from "./index";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export async function callGemini(
  env: Env,
  system: string,
  user: string,
  responseSchema: unknown,
): Promise<string> {
  const key = env.GEMINI_API_KEY;
  if (!key) {
    throw new LlmError("Ключ Gemini не настроен. Добавьте секрет GEMINI_API_KEY и попробуйте снова.");
  }

  // Google retires model names and stops serving them to new keys, so the
  // name lives in LLM_MODEL and this is only the fallback.
  const model = env.LLM_MODEL || "gemini-3.6-flash";
  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 1,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema,
      },
    }),
  });

  if (response.status === 429) {
    throw new LlmError("Бесплатный лимит Gemini на сегодня исчерпан. Попробуйте завтра.");
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 404 && /model/i.test(detail)) {
      throw new LlmError(
        `Модель «${model}» больше не обслуживается. Замените переменную LLM_MODEL на ту, ` +
          `которую называет Google: ${extractSuggestedModel(detail) ?? "см. ответ API"}.`,
      );
    }
    throw new LlmError(`Gemini ответил ошибкой ${response.status}. ${detail.slice(0, 180)}`.trim());
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) throw new LlmError("Gemini вернул пустой ответ. Попробуйте ещё раз.");
  return text;
}

/** Pulls the replacement Google names in its retirement notice, if it named one. */
function extractSuggestedModel(detail: string): string | null {
  return detail.match(/models\/([A-Za-z0-9.\-]+)\s+for/)?.[1] ?? null;
}
