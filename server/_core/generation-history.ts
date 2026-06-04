/**
 * Сохранение и чтение истории генераций (P1.2).
 *
 * После каждого вызова content.generatePost / generateReelsScript /
 * generateCarousel и т.п. мы пишем результат сюда. Это позволяет
 * юзеру сравнивать версии («попробовал 3 раза — вот они все, какая
 * лучше?») и возвращаться к удачным.
 *
 * Контракт payload: JSON-сериализуемый объект с полным результатом
 * генерации (текст + входные параметры). Конкретная форма зависит
 * от kind — клиент знает, как её разбирать. Сервер payload не
 * парсит, только хранит.
 */
import { d1Execute, d1Query, isD1Configured } from "./d1";

const MAX_PER_USER = 50;

export type HistoryRow = {
  id: string;
  kind: string;
  title: string;
  payload: unknown;
  createdAt: number;
};

export async function recordGeneration(opts: {
  userId: string;
  kind: string;
  title: string;
  payload: unknown;
}): Promise<void> {
  if (!isD1Configured()) return;
  const id = crypto.randomUUID();
  try {
    await d1Execute(
      "INSERT INTO generation_history (id, workspace_key, kind, title, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, opts.userId, opts.kind, opts.title.slice(0, 200), JSON.stringify(opts.payload), Date.now()],
    );
  } catch {
    /* запись истории не критична, не блокируем основной ответ юзеру */
    return;
  }

  /* FIFO-обрезка. Берём id всех записей юзера старше MAX_PER_USER
     по дате и удаляем. Один extra SELECT + один DELETE — дёшево. */
  try {
    const old = await d1Query<{ id: string }>(
      `SELECT id FROM generation_history WHERE workspace_key = ?
       ORDER BY created_at DESC LIMIT 1000 OFFSET ?`,
      [opts.userId, MAX_PER_USER],
    );
    if (old.length > 0) {
      const ids = old.map((r) => `'${r.id.replace(/'/g, "''")}'`).join(",");
      await d1Execute(
        `DELETE FROM generation_history WHERE workspace_key = ? AND id IN (${ids})`,
        [opts.userId],
      );
    }
  } catch {
    /* не критично — лимит просто временно превышен */
  }
}
