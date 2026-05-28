-- Integrations: per-workspace голосовой профиль и снапшоты публичных каналов
-- (Telegram t.me/s/<channel>, Instagram). Хранится одной JSON-строкой:
-- { tg: {...}, ig: {...}, voiceProfile: {...} }
CREATE TABLE IF NOT EXISTS integrations (
  workspace_key TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
