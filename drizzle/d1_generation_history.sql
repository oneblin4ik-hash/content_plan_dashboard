-- История генераций (P1.2 — сравнение версий).
--
-- Каждая итерация поста сохраняется отдельной строкой. Поле payload —
-- JSON с полным результатом (текст поста + параметры генерации:
-- tone/length/rubric/templateId), чтобы при «открыть в Студии» можно
-- было восстановить полный контекст.
--
-- Лимит — 50 последних на юзера, FIFO. Чистка делается в коде после
-- INSERT (D1 без триггеров). Для редких генераций таблица почти
-- пустая; даже 50×1000 юзеров ≈ 50K строк — мелочь для D1.
--
-- Скоупинг по workspace_key = users.id, как везде.
CREATE TABLE IF NOT EXISTS generation_history (
  id TEXT PRIMARY KEY,
  workspace_key TEXT NOT NULL,
  kind TEXT NOT NULL,            -- 'post' | 'reels' | 'carousel' | 'pack' и т.п.
  title TEXT NOT NULL,           -- тема, по которой генерировали
  payload TEXT NOT NULL,         -- JSON c результатом и параметрами
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gen_hist_ws_ts ON generation_history(workspace_key, created_at DESC);
