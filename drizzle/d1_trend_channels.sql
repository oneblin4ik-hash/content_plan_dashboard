-- Список TG-каналов для парсинга трендов конкурентов в фитнес-нише.
-- Системно-общий (без workspace_key) — общие тренды всем юзерам.
-- Поле status показывает результат последнего парсинга: ok = вернул посты,
-- empty = HTTP 200, но постов 0 (вероятно несуществующий канал),
-- http_error = >=400, fetch_error = network/timeout.
CREATE TABLE IF NOT EXISTS trend_channels (
  name TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_post_count INTEGER NOT NULL DEFAULT 0,
  last_fetched_at INTEGER,
  last_error TEXT,
  added_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trend_channels_enabled ON trend_channels(enabled);
