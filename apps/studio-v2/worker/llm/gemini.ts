import type { Env } from "../env";
import { LlmError } from "./index";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Mirrors the shape parseIdeas expects, so the model cannot drift. */
const responseSchema = {
  type: "OBJECT",
  properties: {
    ideas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          hook: { type: "STRING" },
          format: { type: "STRING" },
          angle: { type: "STRING" },
          visual: { type: "STRING" },
          cta: { type: "STRING" },
          channel: { type: "STRING", enum: ["telegram", "reels"] },
          objective: { type: "STRING" },
        },
        required: ["title", "hook", "format", "angle", "visual", "cta", "channel", "objective"],
      },
    },
  },
  required: ["ideas"],
};

export async function callGemini(env: Env, system: string, user: string): Promise<string> {
  const key = env.GEMINI_API_KEY;
  if (!key) {
    throw new LlmError("Ключ Gemini не настроен. Добавьте секрет GEMINI_API_KEY и попробуйте снова.");
  }

  const model = env.LLM_MODEL || "gemini-2.5-flash";
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
    throw new LlmError(`Gemini ответил ошибкой ${response.status}. ${detail.slice(0, 180)}`.trim());
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) throw new LlmError("Gemini вернул пустой ответ. Попробуйте ещё раз.");
  return text;
}
