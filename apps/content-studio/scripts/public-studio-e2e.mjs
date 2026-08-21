import { chromium } from "playwright-core";

const baseUrl = process.env.PUBLIC_STUDIO_URL ?? "http://localhost:3000";
const chromiumPath = "/usr/bin/chromium";
const qaIdea = "QA e2e · идея public";
const qaIdeaEdited = "QA e2e · идея public отредактирована";
const qaMaterial = "QA e2e · материал из Studio";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, payload) {
  const response = await fetch(`${baseUrl}/api/trpc/${path}?batch=1`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ 0: { json: payload } }),
  });
  if (!response.ok) throw new Error(`API ${path} failed: ${response.status}`);
  return response.json();
}

async function cleanup() {
  const response = await fetch(`${baseUrl}/api/trpc/contentStudio.bootstrap?batch=1&input=${encodeURIComponent('{"0":{"json":null}}')}`);
  if (!response.ok) return;
  const payload = await response.json();
  const items = payload?.[0]?.result?.data?.json?.items ?? [];
  for (const item of items.filter((entry) => entry.title?.startsWith("QA e2e"))) {
    await api("contentStudio.item.delete", { id: item.id });
  }
}

const browser = await chromium.launch({ executablePath: chromiumPath, headless: true, args: ["--no-sandbox"] });
let page;
let generatedCount = null;

try {
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.route("**/api/trpc/contentStudio.ideas.generate?batch=1", async route => {
    generatedCount = route.request().postDataJSON()?.["0"]?.json?.count ?? null;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify([{ result: { data: { json: { ideas: [
      { title: "QA e2e · viral план Б", hook: "Если сегодня есть только 20 минут — это уже план.", format: "POV", angle: "Показать реальный план Б вместо ожидания идеального вечера.", visual: "Таймер и коврик дома", cta: "Сохрани на будний вечер", channel: "reels", objective: "Сохранения" },
      { title: "QA e2e · viral офисный обед", hook: "Твой обед не обязан быть идеальным, чтобы поддержать форму.", format: "Разбор дня", angle: "Разобрать три рабочих выбора в офисной столовой.", visual: "Ланч-бокс и офисный стол", cta: "Ответь словом ОФИС", channel: "telegram", objective: "Диалог" },
      { title: "QA e2e · viral возврат", hook: "Один пропуск — не отмена всей недели.", format: "План Б", angle: "Дать одно правило возвращения в ритм.", visual: "Календарь с одной пропущенной отметкой", cta: "Перешли подруге", channel: "reels", objective: "Пересылки" },
    ] } } } }]) });
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Идеи", exact: true }).waitFor();

  // Viral ideas: render generated cards and move a chosen idea into the standard save form.
  await page.locator(".idea-count").getByRole("button", { name: "3" }).click();
  await page.getByRole("button", { name: "Сгенерировать 3 идеи" }).click();
  const generated = page.locator(".viral-idea-card").filter({ hasText: "QA e2e · viral план Б" });
  await generated.waitFor();
  assert(generatedCount === 3, "The selected idea count was not sent to the generator");
  await generated.getByRole("button", { name: "Сохранить в банк" }).click();
  await page.locator(".idea-row").filter({ hasText: "QA e2e · viral план Б" }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".idea-row").filter({ hasText: "QA e2e · viral план Б" }).waitFor();

  // Ideas: create and edit without login.
  await page.getByRole("button", { name: "Новая идея" }).click();
  const modal = page.locator(".dialog-card");
  await modal.getByPlaceholder("О чём стоит поговорить с аудиторией?").fill(qaIdea);
  await modal.getByPlaceholder("Фраза, которая цепляет внимание").fill("Проверяем общий доступ без аккаунта");
  await modal.getByRole("button", { name: "Сохранить" }).click();
  const ideaRow = page.locator(".idea-row").filter({ hasText: qaIdea });
  await ideaRow.waitFor();
  await ideaRow.getByTitle("Редактировать").click();
  await modal.getByPlaceholder("О чём стоит поговорить с аудиторией?").fill(qaIdeaEdited);
  await modal.getByRole("button", { name: "Сохранить" }).click();
  await page.locator(".idea-row").filter({ hasText: qaIdeaEdited }).waitFor();

  // Studio: save a material with goal and voice context.
  await page.locator(".nav-entry").filter({ hasText: "Студия" }).click();
  await page.locator(".composer-work .form-grid input").first().fill(qaMaterial);
  await page.locator(".composer-context input").fill("Проверка сохранения public-материала");
  await page.locator(".composer-work .form-grid textarea").nth(1).fill("Короткий черновик для проверки сохранения.");
  await page.locator(".composer-work .button-primary.full").click();
  await page.locator(".material-card").filter({ hasText: qaMaterial }).waitFor();

  // Library and planner: schedule then publish the material.
  const material = page.locator(".material-card").filter({ hasText: qaMaterial });
  await material.getByTitle("В план").click();
  const planned = page.locator(".calendar-card").filter({ hasText: qaMaterial });
  await planned.waitFor();
  await planned.locator('input[type="date"]').fill("2026-08-30");
  await planned.getByRole("button", { name: /Опубликовано/ }).click();

  // Voice and audience section is reachable publicly.
  await page.locator(".nav-entry").filter({ hasText: "Голос и ЦА" }).click();
  await page.getByText("Голос автора").waitFor();

  // Analytics: record a result in public workspace.
  await page.locator(".nav-entry").filter({ hasText: "Аналитика" }).click();
  await page.getByRole("button", { name: "Внести результат" }).click();
  const metricModal = page.locator(".dialog-card");
  await metricModal.locator('input[name="views"]').fill("42");
  await metricModal.locator('input[name="saves"]').fill("7");
  await metricModal.locator('input[name="leads"]').fill("1");
  await metricModal.getByRole("button", { name: "Добавить результат" }).click();
  await page.getByText(qaMaterial).waitFor();

  // Persistence through a true page reload.
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".idea-row").filter({ hasText: qaIdeaEdited }).waitFor();
  await page.locator(".nav-entry").filter({ hasText: "Библиотека" }).click();
  await page.locator(".material-card").filter({ hasText: qaMaterial }).waitFor();

  // iPhone 16 Pro: tap and horizontal section swipes remain available.
  const mobile = await browser.newPage({ viewport: { width: 402, height: 874 } });
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  await mobile.locator(".nav-entry").filter({ hasText: "Студия" }).click();
  await mobile.getByText("Быстрые шаблоны").waitFor();
  await mobile.locator(".nav-entry").filter({ hasText: "Идеи" }).click();
  await mobile.getByRole("heading", { name: "Идеи", exact: true }).waitFor();
  await mobile.locator(".studio-main").evaluate(node => {
    const start = new Touch({ identifier: 1, target: node, clientX: 360, clientY: 220 });
    const end = new Touch({ identifier: 1, target: node, clientX: 120, clientY: 220 });
    node.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start], changedTouches: [start] }));
    node.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [end] }));
  });
  await mobile.getByText("Быстрые шаблоны").waitFor();
  await mobile.locator(".studio-main").evaluate(node => {
    const start = new Touch({ identifier: 1, target: node, clientX: 120, clientY: 220 });
    const end = new Touch({ identifier: 1, target: node, clientX: 360, clientY: 220 });
    node.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start], changedTouches: [start] }));
    node.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [end] }));
  });
  await mobile.getByRole("heading", { name: "Идеи", exact: true }).waitFor();
  await mobile.close();

  console.log(JSON.stringify({ success: true, checked: ["idea-count", "viral-ideas-ui", "ideas-create-edit", "studio-save", "plan-publish", "voice", "analytics", "reload-persistence", "iphone-16-pro-tap-and-swipe"] }));
} finally {
  await cleanup();
  await browser.close();
}
