-- Конкуренты для анализа (раздел /analytics → таб «Конкуренты»).
-- Платформа: tg (Telegram public preview) или yt (YouTube HTML scrape).
-- Per-канал кэш статистики (sample_posts_json) и AI-отчёта (analysis_json).
CREATE TABLE IF NOT EXISTS competitor_channels (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('tg', 'yt')),
  handle TEXT NOT NULL,
  title TEXT,
  subscribers INTEGER,
  avg_views INTEGER,
  bio TEXT,
  sample_posts_json TEXT,
  analysis_json TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_synced_at INTEGER,
  last_analyzed_at INTEGER,
  last_error TEXT,
  added_at INTEGER NOT NULL,
  UNIQUE (platform, handle)
);
CREATE INDEX IF NOT EXISTS idx_competitor_platform ON competitor_channels(platform);
