CREATE TABLE IF NOT EXISTS post_metrics (
  id TEXT PRIMARY KEY,
  workspace_key TEXT NOT NULL,
  post_title TEXT NOT NULL,
  post_type TEXT NOT NULL,
  platform TEXT,
  topic TEXT,
  published_at INTEGER NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  reactions INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_metrics_ws ON post_metrics(workspace_key);
CREATE INDEX IF NOT EXISTS idx_metrics_published ON post_metrics(published_at DESC);
