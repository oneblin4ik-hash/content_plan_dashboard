CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  workspace_key TEXT NOT NULL,
  title TEXT NOT NULL,
  mode TEXT NOT NULL,
  platform TEXT,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_generations_ws ON generations(workspace_key);
CREATE INDEX IF NOT EXISTS idx_generations_created ON generations(created_at);

CREATE TABLE IF NOT EXISTS scheduled (
  id TEXT PRIMARY KEY,
  workspace_key TEXT NOT NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  format TEXT,
  topic_id INTEGER,
  status TEXT NOT NULL DEFAULT 'planned',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scheduled_ws ON scheduled(workspace_key);
CREATE INDEX IF NOT EXISTS idx_scheduled_date ON scheduled(date);

CREATE TABLE IF NOT EXISTS published_state (
  workspace_key TEXT NOT NULL,
  topic_id INTEGER NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  engagement_rate_x100 INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_key, topic_id)
);
