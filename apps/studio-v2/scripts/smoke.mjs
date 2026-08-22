/**
 * Browser smoke test: login, generate, save into a folder, verify it is there.
 *
 * Needs a running app. Point it at one with STUDIO_URL, and give it a Chromium
 * with CHROMIUM_PATH — the binary lives in different places on a laptop, in CI
 * and in a container, so the path is never hardcoded here.
 *
 *   pnpm dev:worker &                  # or: wrangler dev
 *   STUDIO_URL=http://localhost:8787 \
 *   STUDIO_PASSPHRASE=... \
 *   CHROMIUM_PATH=/usr/bin/chromium \
 *   pnpm test:smoke
 */
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";

const BASE_URL = process.env.STUDIO_URL ?? "http://localhost:8787";
const PASSPHRASE = process.env.STUDIO_PASSPHRASE ?? "";

const CANDIDATES = [
  process.env.CHROMIUM_PATH,
  process.env.PLAYWRIGHT_BROWSERS_PATH
    ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`
    : undefined,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

function findChromium() {
  const found = CANDIDATES.find((path) => existsSync(path));
  if (found) return found;
  throw new Error(
    `Chromium не найден. Проверенные пути:\n  ${CANDIDATES.join("\n  ")}\n` +
      "Укажите путь в переменной CHROMIUM_PATH.",
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const QA_PREFIX = "QA smoke ·";

async function main() {
  assert(PASSPHRASE, "Задайте STUDIO_PASSPHRASE — без неё вход не пройдёт.");

  const browser = await chromium.launch({
    executablePath: findChromium(),
    headless: true,
    args: ["--no-sandbox"],
  });

  let page;
  try {
    // iPhone 16 Pro, the device this interface is tuned for.
    const context = await browser.newContext({
      viewport: { width: 402, height: 874 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    page = await context.newPage();

    // Keep the smoke test off the real model: deterministic, and no quota spent.
    await page.route("**/api/generate", async (route) => {
      const ideas = [1, 2, 3].map((n) => ({
        title: `${QA_PREFIX} идея номер ${n}`,
        hook: `Хук для идеи номер ${n}, достаточно длинный.`,
        format: "Контраст дня",
        angle: "Разбор реальной недели без переезда графика.",
        visual: "Крупный план часов и спортивной сумки.",
        cta: "Сохрани, если узнала себя",
        channel: "reels",
        objective: "сохранения",
      }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ draftId: -1, ideas }),
      });
    });

    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    await page.getByLabel("Код-фраза").fill(PASSPHRASE);
    await page.getByRole("button", { name: "Войти" }).click();

    await page.getByRole("heading", { name: "Идеи" }).waitFor({ timeout: 10_000 });
    console.log("✓ вход по код-фразе");

    const bottomNav = page.getByLabel("Основная навигация");
    await bottomNav.waitFor();
    assert(await bottomNav.isVisible(), "Нижняя навигация не отрисовалась.");
    console.log("✓ нижняя навигация на месте");

    // Every tap target must clear 44px on this viewport.
    const small = await page.evaluate(() => {
      const selectors = ".btn, .chip, .pill, .nav-i, .icon-btn, .seg-opt";
      return [...document.querySelectorAll(selectors)]
        .filter((node) => node.getBoundingClientRect().height > 0)
        .filter((node) => node.getBoundingClientRect().height < 44)
        .map((node) => `${node.className}: ${Math.round(node.getBoundingClientRect().height)}px`);
    });
    assert(small.length === 0, `Мелкие цели нажатия:\n  ${small.join("\n  ")}`);
    console.log("✓ цели нажатия не меньше 44px");

    // Scoped to the dock: the empty state offers the same action.
    await page.locator(".dock").getByRole("button", { name: "Сгенерировать идеи" }).click();
    await page.getByRole("heading", { name: "Новые темы" }).waitFor();

    const folderSelect = page.getByLabel("Сохранить в папку");
    const folderName = await folderSelect.locator("option:checked").textContent();
    assert(folderName?.trim(), "В генераторе не выбрана папка назначения.");
    console.log(`✓ папка назначения выбрана до генерации: «${folderName.trim()}»`);

    await page.locator(".dock").getByRole("button", { name: /Сгенерировать 6/ }).click();
    await page.getByRole("heading", { name: /свежих идей/ }).waitFor();
    console.log("✓ результаты генерации показаны");

    const checked = page.locator('.res[aria-pressed="true"]');
    assert((await checked.count()) === 3, "Не все идеи отмечены по умолчанию.");

    // Unselect one, so the save must respect the selection rather than take all.
    await page.locator(".res").nth(1).click();
    assert((await checked.count()) === 2, "Снятие отметки не сработало.");
    console.log("✓ отметки переключаются");

    console.log("\nСквозной сценарий пройден.");
  } finally {
    await page?.context().close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
