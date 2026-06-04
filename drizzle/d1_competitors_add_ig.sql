-- Расширение competitor_channels: добавить Instagram ('ig') в CHECK.
--
-- SQLite не умеет ALTER CHECK — пересоздаём таблицу через rename+copy.
-- Сохраняем все данные. Новый CHECK: platform IN ('tg','yt','ig').
--
-- Делается один раз. Безопасно при повторном запуске? Нет — поэтому
-- защищаемся: если временной таблицы нет и основная уже имеет нужный
-- CHECK, повтор приведёт к ошибке «table exists». Запускать однократно.
ALTER TABLE competitor_channels RENAME TO competitor_channels_old;

CREATE TABLE competitor_channels (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('tg', 'yt', 'ig')),
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

INSERT INTO competitor_channels
  SELECT id, platform, handle, title, subscribers, avg_views, bio,
         sample_posts_json, analysis_json, status, last_synced_at,
         last_analyzed_at, last_error, added_at
  FROM competitor_channels_old;

DROP TABLE competitor_channels_old;
