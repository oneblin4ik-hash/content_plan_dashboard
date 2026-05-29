-- User-generated content topics (идея #2 из доработок).
-- Темы, сгенерированные пользователем через «Сгенерировать ещё» в Плане.
-- Хардкод-темы из client/src/lib/contentData.ts остаются как стартовый
-- набор; эта таблица хранит только пользовательские дополнения.
CREATE TABLE IF NOT EXISTS user_topics (
  id TEXT PRIMARY KEY,
  workspace_key TEXT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  format TEXT NOT NULL,
  potential TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_topics_ws ON user_topics(workspace_key);
CREATE INDEX IF NOT EXISTS idx_user_topics_created ON user_topics(created_at DESC);
