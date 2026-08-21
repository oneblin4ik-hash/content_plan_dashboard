import { chromium } from "playwright-core";

const baseUrl = process.env.PUBLIC_STUDIO_URL ?? "http://localhost:3000";
const chromiumPath = "/usr/bin/chromium";

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

async function cleanup(title) {
  if (!title) return;
  const response = await fetch(`${baseUrl}/api/trpc/contentStudio.bootstrap?batch=1&input=${encodeURIComponent('{"0":{"json":null}}')}`);
  if (!response.ok) return;
  const payload = await response.json();
  const items = payload?.[0]?.result?.data?.json?.items ?? [];
  for (const item of items.filter(entry => entry.title === title)) await api("contentStudio.item.delete", { id: item.id });
}

const browser = await chromium.launch({ executablePath: chromiumPath, headless: true, args: ["--no-sandbox"] });
let title = "";

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Идеи", exact: true }).waitFor();
  await page.getByPlaceholder("Например: питание в офисе, пропуски тренировок").fill("безопасный старт в тренировках для занятой женщины");
  await page.getByRole("button", { name: "Сгенерировать 6 идей" }).click();
  const firstCard = page.locator(".viral-idea-card").first();
  await firstCard.waitFor({ timeout: 120_000 });
  title = (await firstCard.locator("h3").textContent())?.trim() ?? "";
  assert(title.length > 0, "Live generator returned a card without a title");
  await firstCard.getByRole("button", { name: "Сохранить в банк" }).click();
  await page.locator(".idea-row").filter({ hasText: title }).waitFor({ timeout: 15_000 });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".idea-row").filter({ hasText: title }).waitFor({ timeout: 15_000 });
  console.log(JSON.stringify({ success: true, checked: ["live-generation", "direct-save", "reload-persistence"] }));
} finally {
  await cleanup(title);
  await browser.close();
}
