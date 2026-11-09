import { chromium } from "playwright";

const baseUrl = process.argv[2];
if (!baseUrl) throw new Error("Usage: node shop.mjs <shop url>");

const requested = [
  ["Lantern", 1],
  ["Backpack", 2],
  ["Kettle", 1],
  ["Notebook", 3],
  ["Speaker", 1],
  ["Thermos", 2],
  ["Headset", 1],
  ["Keyboard", 2],
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  await page.goto(baseUrl);

  const items = [];
  for (const [term, quantity] of requested) {
    await page.getByRole("link", { name: "Bench Shop" }).click();
    await page.getByRole("textbox", { name: "Search" }).fill(term);
    await page.getByRole("button", { name: "Search" }).click();
    const firstResult = page.locator("main li a").first();
    await firstResult.waitFor();
    await firstResult.click();
    const product = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
    await page.getByRole("spinbutton", { name: "Quantity" }).fill(String(quantity));
    await page.getByRole("button", { name: "Add to cart" }).click();
    items.push({ product, quantity });
  }

  await page.getByRole("link", { name: "Cart" }).click();
  const cartText = await page.locator("main").innerText();
  const totalMatch = cartText.match(/Total\s*:?\s*(\$[\d,.]+)/i);
  if (!totalMatch) throw new Error(`Could not find cart total in: ${cartText}`);
  console.log(JSON.stringify({ items, total: totalMatch[1] }));
} finally {
  await browser.close();
}
