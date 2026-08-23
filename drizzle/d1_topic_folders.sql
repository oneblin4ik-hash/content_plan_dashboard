-- Папки (коллекции) для тем в разделе «Идеи».
--
-- Идея из конкурентного анализа Virale: группировать темы по папкам
-- («Питание», «Тренировки», «Мотивация»), чтобы библиотека не была
-- плоским списком. Скоупинг по workspace_key = users.id, как везде.
--
-- user_topics.folder_id — необязательная привязка темы к папке. NULL =
-- «без папки» (показывается во «Все»). При удалении папки темы не
-- удаляются — folder_id просто обнуляется (ON DELETE SET NULL).
CREATE TABLE IF NOT EXISTS topic_folders (
  id TEXT PRIMARY KEY,
  workspace_key TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_topic_folders_ws ON topic_folders(workspace_key);

ALTER TABLE user_topics ADD COLUMN folder_id TEXT;
