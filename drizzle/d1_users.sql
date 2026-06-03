-- Multi-tenant миграция: пользователи + per-user конфиг голоса.
--
-- Идентификатор пользователя (users.id) одновременно служит
-- workspace_key для всех ранее созданных per-workspace таблиц
-- (library, scheduled, post_metrics, integrations, user_topics,
-- telegram_chats и т.д.). Это позволяет не переименовывать колонки и
-- не мигрировать данные — старые workspace_key логически становятся
-- «осиротевшими» (без юзера), новые юзеры получают свой id из users.
--
-- Аутентификация stateless через JWT в HTTP-only cookie: таблицы
-- sessions нет. Если в будущем нужен revoke — добавим.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at INTEGER NOT NULL,
  -- ФЗ-152: фиксируем момент согласия на обработку перс. данных и
  -- принятие пользовательского соглашения. Не NULL — оба согласия
  -- обязательны для регистрации, без них INSERT не проходит на UI.
  consent_personal_data_at INTEGER NOT NULL,
  consent_terms_at INTEGER NOT NULL,
  -- Тариф: 'trial' / 'pro' / 'team' (платных пока нет). Триал = 3 дня
  -- с момента регистрации; UI и серверный guard смотрят trial_ends_at.
  plan TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at INTEGER NOT NULL,
  -- Бюджет токенов на триал в «пользовательской» шкале: 1 токен
  -- баланса = 10 реальных токенов Gemini (TOKEN_DIVISOR в
  -- server/_core/llm-guard.ts). Списываем ceil(total_tokens/10)
  -- после каждого ответа LLM. Когда 0 ИЛИ trial_ends_at истёк —
  -- блок генерации. Платные планы пополняют это поле при апгрейде.
  tokens_remaining INTEGER NOT NULL DEFAULT 3000,
  tokens_used_total INTEGER NOT NULL DEFAULT 0,
  -- Per-user настройки голоса (имя/ниша/ЦА/обращение/эмодзи и т.п.)
  -- хранятся как JSON, чтобы добавлять поля без миграций. Формат
  -- описан в server/_core/voice-config.ts → VoiceConfig.
  voice_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
