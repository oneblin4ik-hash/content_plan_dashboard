# OpenMontage для русского вертикального видео

Рабочая обвязка над [OpenMontage](https://github.com/calesthio/OpenMontage) для монтажа
вертикального ролика с русскими субтитрами и анимацией — **только на бесплатных
инструментах**, без единого API-ключа.

## Что здесь лежит

| Файл | Назначение |
|---|---|
| `produce.py` | Конвейер: анализ → распознавание → чистка звука → цветокор → субтитры и оверлеи → QA |
| `openmontage-ru-fixes.patch` | Четыре правки в апстрим OpenMontage, без которых русский не работает |
| `cyrillicFonts.ts` | Модуль загрузки кириллических шрифтов для Remotion |
| `fonts/` | Кириллические сабсеты Montserrat, Inter, Playfair Display (woff2, ~90 КБ) |

## Что пришлось починить в OpenMontage

Апстрим не готов к кириллице и к самому себе. Найдено и исправлено при прогоне:

1. **Композиции используют Space Grotesk, у которого нет кириллицы вообще.**
   Русский текст падал в fallback. Заменено на Montserrat/Inter/Playfair
   с кириллическими сабсетами, вшитыми в бандл как base64 — рендеру больше
   не нужен `fonts.gstatic.com`.

2. **`remotion_caption_burn` формировал путь `public/talking-head/<file>`,
   а `staticFile()` этот префикс явно запрещает.** Основной путь инструмента
   падал всегда; работал только ffmpeg-фолбэк. Префикс убран.

3. **Разделитель слов в субтитрах пропадал.** Пробел стоял внутри
   `inline-block` со `white-space: nowrap`, где браузер обрезает концевой
   пробел — слова слипались («Иван,исегодня»). Затрагивает любой язык
   с пробелами, не только русский. Разделитель вынесен наружу спана.

4. **`face_tracker` падал на mediapipe 1.0**, где выпилен legacy-API
   `mp.solutions`. Проверка доступности теперь смотрит на сам API, а не на
   факт импорта; в связке используется mediapipe 0.10.14.

Плюс правка на стороне вызова: `audio_enhance` кодирует в AAC независимо от
расширения, поэтому `.wav` на выходе даёт битый контейнер — просим `.m4a`.

## Установка

```bash
git clone https://github.com/calesthio/OpenMontage.git
cd OpenMontage && make setup

# распознавание речи и трекинг лица
.venv/bin/python -m pip install faster-whisper opencv-python-headless "mediapipe==0.10.14"

# правки под кириллицу
git apply /path/to/openmontage-ru-fixes.patch
cp -r /path/to/fonts remotion-composer/public/fonts
```

Шрифтовые данные для бандла генерируются из `public/fonts/` в
`remotion-composer/src/lib/cyrillicFontData.ts` (base64 woff2).

Нужны также `ffmpeg`, `Node.js 18+` и Chromium для Remotion
(`REMOTION_BROWSER_EXECUTABLE`, если Remotion не может скачать свой).

## Запуск

```bash
REMOTION_BROWSER_EXECUTABLE=/path/to/chromium \
OPENMONTAGE_ROOT=/path/to/OpenMontage \
python produce.py video.mp4 --outdir out --overlays overlays.json
```

Ключи: `--model` (по умолчанию `large-v3`), `--language ru`,
`--words-per-page`, `--font-size`, `--highlight`, `--grade`, `--skip-audio`.

### Формат оверлеев

```json
[
  {"type": "hero_title",  "in_seconds": 0.3, "out_seconds": 3.2,
   "position": "full_overlay", "text": "ЗАГОЛОВОК"},
  {"type": "callout",     "in_seconds": 6.7, "out_seconds": 9.2,
   "position": "upper_third", "text": "Тезис", "callout_type": "tip"},
  {"type": "stat_card",   "in_seconds": 9.4, "out_seconds": 11.3,
   "position": "lower_third", "stat": "100%", "text": "подпись"}
]
```

Доступные типы: `hero_title`, `section_title`, `text_card`, `stat_card`,
`stat_reveal`, `callout`, `comparison`, `bar_chart`, `line_chart`,
`pie_chart`, `kpi_grid`.

### Исправление распознанных слов

`--corrections corrections.json` принимает словарь замен — полезно для имён,
брендов и терминов, которые Whisper слышит неверно:

```json
{"клод": "Claude", "опенмонтаж": "OpenMontage"}
```

## Что получается на выходе

```
out/
├── final.mp4            готовый ролик
├── subtitles.ru.srt     отдельный файл субтитров
├── transcript.json      транскрипт с потайминговкой по словам
├── render_report.json   параметры источника и результат QA
└── qa/                  кадры для визуальной проверки
```

## Проверено

Прогон на 14-секундном вертикальном ролике 1080×1920: распознавание 48 с,
рендер 88 с, весь конвейер 2 мин 53 с, QA чистый. Тесты самого OpenMontage —
1827 passed, 1 failed (`test_network_guard`, проверяет отсутствие сети
в песочнице; к правкам отношения не имеет).

Ориентир для 50 секунд — 7–9 минут на 4 ядрах.

## Чего в бесплатном контуре нет

- **Фоновая музыка.** `pixabay_music` отдаёт 403. В репозитории есть только
  SFX (`whoosh`, `impact`, `riser`, `chime` — 19 файлов в
  `.agents/skills/hyperframes-media/assets/sfx/`). Для музыки нужен свой трек
  или бесплатный ключ Pixabay/Freesound.
- **Генерация видео и премиум-озвучка** — всё через платные API.
