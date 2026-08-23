CREATE TABLE IF NOT EXISTS trend_topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  why_viral TEXT NOT NULL,
  source_channels TEXT NOT NULL,
  examples_json TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trends_fetched ON trend_topics(fetched_at DESC);

CREATE TABLE IF NOT EXISTS trend_refresh_log (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT NOT NULL,
  topics_count INTEGER NOT NULL DEFAULT 0,
  error_text TEXT
);
