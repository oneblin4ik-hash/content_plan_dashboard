# Content Studio — Serbolin

**Content Studio** — личный инструмент Эдуарда Серболина для планирования Telegram-постов и сценариев Reels. Это рабочая копия исходного кода приложения, которое развёрнуто в Manus. Продолжать разработку следует только в этой папке: `apps/content-studio/`.

> Приложение открывается по прямой ссылке без входа. Все действия сохраняются в единое серверное рабочее пространство `personal`, поэтому интерфейс и данные синхронизируются между устройствами.

## Быстрый старт

| Команда | Назначение |
|---|---|
| `pnpm install` | Установить зависимости. |
| `pnpm dev` | Запустить локальную среду разработки. |
| `pnpm check` | Проверить типы TypeScript. |
| `pnpm test` | Запустить unit-тесты Vitest. |
| `pnpm test:e2e:public` | Выполнить основной browser e2e-сценарий публичной студии. |
| `pnpm test:e2e:haptic-fallback` | Проверить iPhone fallback без `navigator.vibrate`. |
| `pnpm test:e2e:viral:live` | Проверить живую генерацию идей; требует настроенного серверного LLM-окружения. |
| `pnpm build` | Собрать production-версию. |

Перед commit запускай минимум:

```bash
pnpm check && pnpm test && pnpm test:e2e:public && pnpm test:e2e:haptic-fallback
```

## Технологии и архитектура

Приложение построено на **React 19**, **Tailwind CSS 4**, **Express 4**, **tRPC 11**, **Drizzle ORM** и **MySQL/TiDB**. Клиент вызывает сервер только через типизированные tRPC-процедуры. Сервер хранит данные, создаёт идеи через встроенный LLM Manus и возвращает их клиенту.

| Уровень | Ответственность | Главные файлы |
|---|---|---|
| Клиент | Семь разделов, мобильная навигация, свайпы, формы и отображение данных. | `client/src/pages/ContentStudioApp.tsx`, `client/src/components/content-studio/StudioViews.tsx` |
| Стили | Тёмная red/orange bento-система, адаптивность, параллакс, iPhone safe areas. | `client/src/index.css`, `client/index.html` |
| Взаимодействия | Безопасный haptic API и Safari/WebKit visual fallback. | `client/src/lib/haptics.ts` |
| API | Public bootstrap, CRUD контента, папок, метрик, голоса, сегментов и настроек. | `server/routers/contentStudio.ts` |
| ИИ | Генератор Telegram/Reels-идей с контекстом Serbolin и сегментов S1–S4. | `server/routers/viralIdeas.ts` |
| Данные | Схема Drizzle и модель хранения общего пространства. | `drizzle/schema.ts`, `server/db.ts` |
| Проверки | Unit-тесты и реальные browser-сценарии. | `*.test.ts`, `scripts/*.mjs` |

## Возможности продукта

Студия содержит разделы **Идеи**, **Студия**, **Избранное**, **План / календарь**, **Библиотека**, **Голос и ЦА** и **Аналитика**. Генератор идей поддерживает выбор сегмента аудитории S1–S4, формата Telegram/Reels и количества результатов 3/6/8. Выбранные идеи можно сохранить в общий банк, превратить в материал и запланировать.

В базе данных используются сущности `cs_workspaces`, `cs_folders`, `cs_items`, `cs_templates`, `cs_voice`, `cs_segments`, `cs_metrics` и `cs_settings`. Не меняй схему «на глаз»: сначала обнови `drizzle/schema.ts`, создай migration и затем примени её к нужной базе данных.

## Мобильное поведение и haptic-feedback

Интерфейс оптимизирован под **iPhone 16 Pro**: нижняя fixed-навигация учитывает `safe-area-inset-bottom`, а по основным разделам можно перемещаться горизонтальным свайпом. Параллакс использует CSS-переменные и `requestAnimationFrame`, чтобы не вызывать React-перерисовки при скролле и движении указателя.

`triggerHaptic()` использует `navigator.vibrate()` только когда API доступен. Safari/WebKit может не давать веб-странице доступ к системной тактильной отдаче; в этом режиме кнопка получает короткий visual pulse через `data-haptic-pressed` и CSS `transform/opacity`. Не заменяй этот fallback на неподдерживаемые или небезопасные обходы платформы.

## Правила продолжения разработки

1. Сначала изучи существующие компоненты и router-процедуры; не создавай дублирующий путь данных через `fetch` или Axios.
2. Для изменения данных используй `trpc.*.useMutation()` и после успеха обновляй кэш/`bootstrap` по существующему паттерну.
3. Новые пользовательские действия должны оставаться удобными на 402×874 px: touch-цель не меньше 44 px, совместимость с нижней навигацией и проверка свайпов.
4. Сохраняй тёмную bento-систему, шрифты **Poppins** для интерфейса и **Merriweather** для заголовков. Для motion анимируй только `transform` и `opacity`; уважай `prefers-reduced-motion`.
5. Не добавляй клиентские секреты, `.env` или ключи LLM в Git. На Manus секреты и публикация управляются отдельно от этого репозитория.
6. Перед отправкой изменений запусти все четыре проверки из блока «Быстрый старт».

## Работа с GitHub

Репозиторий: [`oneblin4ik-hash/content_plan_dashboard`](https://github.com/oneblin4ik-hash/content_plan_dashboard). Рабочая ветка — `main`; Content Studio находится в `apps/content-studio/`. Для самостоятельной задачи используй отдельную ветку и не перезаписывай параллельные изменения:

```bash
git checkout -b feature/short-description
# изменения и проверки
git add apps/content-studio
git commit -m "Describe the change"
git push -u origin feature/short-description
```

## Граница между GitHub и Manus

GitHub хранит синхронизированный исходный код. Production-база, переменные окружения, встроенный LLM API и публикация находятся в проекте Manus `fitness-strategy-hub`. Локальный запуск без этих переменных подходит для работы над интерфейсом и unit-тестами, но живые серверные интеграции могут потребовать отдельного окружения.
