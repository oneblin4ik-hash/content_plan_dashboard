import { chromium } from "playwright-core";

const baseUrl = process.env.PUBLIC_STUDIO_URL ?? "http://localhost:3000";
const qaTitle = `QA fallback · ${Date.now()}`;

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
  for (const item of items.filter(entry => entry.title === qaTitle)) await api("contentStudio.item.delete", { id: item.id });
}

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];

page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });

try {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: undefined });
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Идеи", exact: true }).waitFor();
  assert(await page.evaluate(() => typeof navigator.vibrate === "undefined"), "The fallback test must run without navigator.vibrate");
  await page.locator(".studio-root[data-haptic-fallback='true']").waitFor();

  const studioButton = page.locator(".mobile-bottom-nav").getByRole("button", { name: "Студия" });
  const buttonBox = await studioButton.boundingBox();
  assert(buttonBox, "The iPhone navigation button is not visible");
  await page.mouse.move(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);
  await page.mouse.down();
  await page.waitForFunction(button => button.dataset.hapticPressed === "true", await studioButton.elementHandle());
  await page.waitForTimeout(24);
  const pressState = await studioButton.evaluate(node => ({ opacity: getComputedStyle(node).opacity, transform: getComputedStyle(node).transform }));
  await page.mouse.up();
  assert(Number(pressState.opacity) < 1 && pressState.transform !== "none", `The visual haptic fallback was not active: ${JSON.stringify(pressState)}`);
  await studioButton.click();
  await page.getByText("Быстрые шаблоны").waitFor();

  await page.locator(".mobile-bottom-nav").getByRole("button", { name: "Идеи" }).click();
  await page.getByRole("button", { name: "Новая идея" }).click();
  const modal = page.locator(".dialog-card");
  await modal.getByPlaceholder("О чём стоит поговорить с аудиторией?").fill(qaTitle);
  await modal.getByRole("button", { name: "Сохранить" }).click();
  await page.locator(".idea-row").filter({ hasText: qaTitle }).waitFor();

  await page.locator(".studio-main").evaluate(node => {
    const start = new Touch({ identifier: 1, target: node, clientX: 360, clientY: 220 });
    const end = new Touch({ identifier: 1, target: node, clientX: 120, clientY: 220 });
    node.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start], changedTouches: [start] }));
    node.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [end] }));
  });
  await page.getByText("Быстрые шаблоны").waitFor();
  assert(errors.length === 0, `Fallback interactions produced browser errors: ${errors.join(" | ")}`);

  console.log(JSON.stringify({ success: true, checked: ["no-vibration-api", "visual-press-feedback", "mobile-navigation", "save-idea", "section-swipe", "no-browser-errors"] }));
} finally {
  await cleanup();
  await context.close();
  await browser.close();
}
