-- Миграция: поддержка email-верификации и password reset.
--
-- Все три «жизненных цикла подтверждения» (verify email, reset password)
-- работают по общему паттерну: одноразовый токен с TTL хранится прямо
-- в users (по одному активному за раз). Это проще таблицы tokens и
-- достаточно для MVP — параллельных reset-запросов одному юзеру не бывает.
--
-- email_verified_at = null → не подтверждён. Юзер всё равно залогинен и
-- может пользоваться сервисом (баннер в UI), но при апгрейде плана и
-- ряде critical-действий мы будем требовать подтверждение.
--
-- *_token хранится как есть (без хеширования) — компрометация D1 уже
-- означает потерю всего, дополнительный hash тут не добавляет защиты.
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
ALTER TABLE users ADD COLUMN email_verification_token TEXT;
ALTER TABLE users ADD COLUMN email_verification_expires_at INTEGER;
ALTER TABLE users ADD COLUMN password_reset_token TEXT;
ALTER TABLE users ADD COLUMN password_reset_expires_at INTEGER;
