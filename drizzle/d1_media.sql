CREATE TABLE IF NOT EXISTS media_items (
  id TEXT PRIMARY KEY,
  workspace_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL,
  thumbnail_url TEXT,
  content_type TEXT NOT NULL DEFAULT 'image',
  r2_key TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_ws ON media_items(workspace_key);
CREATE INDEX IF NOT EXISTS idx_media_created ON media_items(created_at DESC);
