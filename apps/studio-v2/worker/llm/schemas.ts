/**
 * Response shapes handed to Gemini so the model cannot drift from what the
 * parsers accept. The OpenAI-compatible providers take plain JSON mode and
 * lean on the prompt instead, so they need no counterpart here.
 */

export const IDEAS_RESPONSE_SCHEMA = {
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
} as const;

export const MATERIAL_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    hook: { type: "STRING" },
    body: { type: "STRING" },
    scenes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          time: { type: "STRING" },
          shot: { type: "STRING" },
          speech: { type: "STRING" },
          caption: { type: "STRING" },
          edit: { type: "STRING" },
        },
        required: ["time", "shot", "speech", "caption", "edit"],
      },
    },
    visual: { type: "STRING" },
    cta: { type: "STRING" },
  },
  required: ["title", "hook", "body", "scenes", "visual", "cta"],
} as const;
