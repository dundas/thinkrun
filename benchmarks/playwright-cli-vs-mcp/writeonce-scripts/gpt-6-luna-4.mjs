import { chromium } from "playwright";

const url = process.argv[2];
if (!url) throw new Error("Usage: node shop.mjs <shop url>");

const items = [
  ["Lantern", 1],
  ["Backpack", 2],
  ["Kettle", 1],
  ["Notebook", 3],
  ["Speaker", 1],
  ["Thermos", 2],
  ["Headset", 1],
  ["Keyboard", 2],
].map(([product, quantity]) => ({ product, quantity }));

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  for (const { product, quantity } of items) {
    await page.goto(url);
    await page.getByRole("textbox", { name: "Search" }).fill(product);
    await page.getByRole("button", { name: "Search" }).click();
    const firstResult = page.locator("main ul li").first().getByRole("link").first();
    await firstResult.click();
    const qty = page.locator('input[type="number"]');
    await qty.fill(String(quantity));
    await page.getByRole("button", { name: /add to cart/i }).click();
  }
  await page.getByRole("link", { name: "Cart" }).click();
  const total = (await page.locator("body").innerText()).match(/(?:Cart )?Total\s*:?\s*(\$[\d,.]+)/i)?.[1];
  if (!total) throw new Error("Could not read cart total");
  console.log(JSON.stringify({ items, total }));
} finally {
  await browser.close();
}
