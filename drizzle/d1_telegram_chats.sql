-- Per-workspace список Telegram-чатов/каналов для отправки.
-- chat_id может быть числовой (-1001234567890 для канала/группы) или
-- @username для публичного канала — оба формата принимаются Telegram
-- Bot API в поле chat_id.
-- Один из чатов помечен is_default = 1; sendPost/Reels берут именно
-- его, если в input.chatId не пришёл явный override.
CREATE TABLE IF NOT EXISTS telegram_chats (
  id TEXT PRIMARY KEY,
  workspace_key TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  title TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  added_at INTEGER NOT NULL,
  UNIQUE (workspace_key, chat_id)
);
CREATE INDEX IF NOT EXISTS idx_telegram_chats_ws ON telegram_chats(workspace_key);
